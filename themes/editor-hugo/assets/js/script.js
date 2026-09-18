(function ($) {
	'use strict';

	// prelaoder
	$('.preloader').delay(100).fadeOut(10);
	
	// sidenav-menu
	function sidenav() {
		$('[data-toggle="sidenav-menu"]').on('click', function () {
			$('.sidenav-menu, .sidenav-overlay').toggleClass('show');
		});
	}
	sidenav();

	// search-popup
	function searchPopup() {
		$('[data-toggle="search"]').on('click', function () {
			$('.search-block').fadeIn(200);
			setTimeout(function () {
				$('.search-block').addClass('is-visible');
				var value = $('#search-field').val();
				$('#search-field').focus().val('').val(value);
			}, 250);
		});
		$('[data-toggle="search-close"]').on('click', function () {
			$('.search-block').fadeOut(200).removeClass('is-visible');
		});
	}
	searchPopup();

	// menuHumBurger icon toggle Init
	function menuHumBurgerIcon() {
		$('.navbar-toggler').on('click', function () {
			$('i').toggleClass('d-inline d-none');
		});
	}
	menuHumBurgerIcon();


	// tab
	$('.tab-content').find('.tab-pane').each(function (idx, item) {
		var navTabs = $(this).closest('.code-tabs').find('.nav-tabs'),
			title = $(this).attr('title');
		navTabs.append('<li class="nav-item"><a class="nav-link" href="#">' + title + '</a></li>');
	});

	$('.code-tabs ul.nav-tabs').each(function () {
		$(this).find("li:first").addClass('active');
	})

	$('.code-tabs .tab-content').each(function () {
		$(this).find("div:first").addClass('active');
	});

	$('.nav-tabs a').click(function (e) {
		e.preventDefault();
		var tab = $(this).parent(),
			tabIndex = tab.index(),
			tabPanel = $(this).closest('.code-tabs'),
			tabPane = tabPanel.find('.tab-pane').eq(tabIndex);
		tabPanel.find('.active').removeClass('active');
		tab.addClass('active');
		tabPane.addClass('active');
	});


	// Accordions
	$('.collapse').on('shown.bs.collapse', function () {
		$(this).parent().find('.fas fa-plus').removeClass('fas fa-plus').addClass('fas fa-minus');
	}).on('hidden.bs.collapse', function () {
		$(this).parent().find('.fas fa-minus').removeClass('fas fa-minus').addClass('fas fa-plus');
	});


	// -- newsletter ---------------------------------------------------------
	//
	// Local memory of what this visitor has already done with the newsletter.
	// It only ever suppresses UI; nothing here is sent anywhere, and a browser
	// that refuses storage (private mode, blocked site data) just sees the
	// default behaviour rather than an error.
	var STORE_SUBSCRIBED = 'btn-newsletter-subscribed';
	var STORE_DISMISSED = 'btn-newsletter-dismissed-until';

	function remember(key, value) {
		try {
			window.localStorage.setItem(key, value);
		} catch (err) {
			/* storage unavailable -- the modal simply reappears next visit */
		}
	}

	function recall(key) {
		try {
			return window.localStorage.getItem(key);
		} catch (err) {
			return null;
		}
	}

	// -- conversion plumbing ------------------------------------------------
	//
	// A signup is reported to Meta twice: once from here by the pixel, and once
	// from the funnel API server-side. Both hand over the SAME id, which is the
	// only thing that makes Meta collapse them into one conversion instead of
	// counting two. So the id is generated before the request and travels with
	// it -- never generated per-half.
	function eventId() {
		try {
			if (window.crypto && window.crypto.randomUUID) {
				return window.crypto.randomUUID();
			}
		} catch (err) {
			/* fall through to the cheap version */
		}
		return 'btn-' + Date.now() + '-' + Math.random().toString(16).slice(2);
	}

	// `_fbp` and `_fbc` are what let Meta match a signup to the browser that
	// clicked the ad, and they have to be read here and posted in the body: the
	// request is cross-origin without credentials and the API sets
	// allow_credentials=False, so the cookies are never sent on their own.
	// Absent is normal -- the pixel sets them, and a visitor who refused has
	// had them cleared.
	function cookie(name) {
		var match = document.cookie.match('(^|;)\\s*' + name + '\\s*=\\s*([^;]+)');
		return match ? match.pop() : '';
	}

	// The Meta click id, from the cookie the pixel writes -- or built from the
	// `fbclid` on the URL when that cookie is not there yet.
	//
	// The fallback exists for paid traffic and nothing else, which is why it
	// arrived with the first campaign rather than with the pixel. An ad click
	// lands on `?fbclid=...`; the pixel then writes `_fbc` from it, but that
	// happens after fbevents.js has loaded over the network. A visitor who
	// types an address into the hero form before that lands -- or whose pixel
	// is blocked outright -- posts a conversion Meta cannot attribute to the
	// ad it just paid for. Nothing errors; the click simply goes unmatched.
	//
	// The shape is Meta's documented `version.subdomainIndex.creationTime.
	// fbclid`. The index is 1 because the pixel writes this cookie at the
	// registrable domain, which script.html already depends on when it deletes
	// it. The timestamp is when we first saw the click, which is this pageview
	// -- the same thing the pixel would have recorded.
	function clickId() {
		var existing = cookie('_fbc');
		if (existing) {
			return existing;
		}
		var match = window.location.search.match(/[?&]fbclid=([^&#]+)/);
		return match ? 'fb.1.' + Date.now() + '.' + decodeURIComponent(match[1]) : '';
	}

	// The banner's answer, forwarded so the server half honours the same
	// choice. Suppressing the pixel while the API kept reporting the same
	// person would make the banner decorative.
	//
	// This is OPT-OUT: only an explicit "rejected" withholds consent, so an
	// unanswered banner still reports. That is a deliberate business decision
	// and it is the one thing here that is legally contentious -- TTDSG s25
	// wants consent BEFORE a marketing cookie is set, and silence is not
	// consent. It is written as "not rejected" rather than "accepted" so that
	// reverting to opt-in is this one expression plus the load condition in
	// script.html, and nothing else.
	function adsConsent() {
		return cookie('cookie-consent') === 'rejected' ? '' : 'yes';
	}

	// The beat chips. "Everything" and a full hand-picked set mean the same
	// subscription, so the two states are kept mutually exclusive rather than
	// letting the form offer a distinction the API does not store: ticking a
	// beat clears "Everything", and clearing the last beat puts it back.
	function beatPickers() {
		$('.subscribe-form').each(function () {
			var $all = $(this).find('.beat-input[value="all"]');
			var $beats = $(this).find('.beat-input').not($all);
			if (!$all.length) {
				return;
			}
			$beats.on('change', function () {
				$all.prop('checked', $beats.filter(':checked').length === 0);
			});
			$all.on('change', function () {
				if ($all.prop('checked')) {
					$beats.prop('checked', false);
				} else if ($beats.filter(':checked').length === 0) {
					// Unticking "Everything" on its own would leave nothing
					// selected, which reads as "send me no mail at all".
					$all.prop('checked', true);
				}
			});
		});
	}
	beatPickers();

	// Links from the newsletter land here carrying their intent in the query:
	// `?topic=devops` pre-ticks that beat (the "+ Add"/"Forwarded to you?"
	// links name one), `?subscribe=1` brings the first form into view and
	// focuses it. A topic the picker does not offer is ignored rather than
	// guessed at -- the chips are the allow-list the API also enforces.
	function prefillFromQuery() {
		var params = new URLSearchParams(window.location.search);
		var topic = (params.get('topic') || '').toLowerCase();
		if (topic) {
			$('.subscribe-form').each(function () {
				var $beat = $(this).find('.beat-input[value="' + topic.replace(/[^a-z0-9-]/g, '') + '"]');
				if ($beat.length) {
					$(this).find('.beat-input').prop('checked', false);
					$beat.prop('checked', true);
				}
			});
		}
		if (params.get('subscribe') === '1') {
			var $email = $('.subscribe-form input[name="email"]').filter(':visible').first();
			if ($email.length) {
				$email[0].scrollIntoView({ block: 'center' });
				$email.trigger('focus');
			}
		}
	}
	prefillFromQuery();

	// First-touch UTM tags, kept for the session so a reader who arrives from a
	// forwarded issue and signs up two pages later is still counted as one.
	// The funnel lifts these into their own columns (attribution.TRACKING_FIELDS),
	// which is what makes `utm_source=forward` signups countable at all.
	var UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
	var STORE_UTM = 'btn-utm';
	function utmTags() {
		var params = new URLSearchParams(window.location.search);
		var fresh = {};
		UTM_KEYS.forEach(function (key) {
			if (params.get(key)) { fresh[key] = params.get(key).slice(0, 200); }
		});
		try {
			if (Object.keys(fresh).length) {
				sessionStorage.setItem(STORE_UTM, JSON.stringify(fresh));
				return fresh;
			}
			return JSON.parse(sessionStorage.getItem(STORE_UTM) || '{}');
		} catch (e) {
			return fresh;
		}
	}
	utmTags();

	// Recognised inbox providers only -- anything else gets no button rather
	// than a guessed webmail URL that might not even exist for that domain.
	// Gmail's is a pre-filled search so the confirmation surfaces even if it
	// landed in Promotions, which a bare inbox link would not do.
	var INBOX_URLS = {
		'gmail.com': 'https://mail.google.com/mail/u/0/#search/from%3Ainfo%40brief-tech-news.com+in%3Aanywhere',
		'googlemail.com': 'https://mail.google.com/mail/u/0/#search/from%3Ainfo%40brief-tech-news.com+in%3Aanywhere',
		'outlook.com': 'https://outlook.live.com/mail/0/inbox',
		'hotmail.com': 'https://outlook.live.com/mail/0/inbox',
		'live.com': 'https://outlook.live.com/mail/0/inbox',
		'yahoo.com': 'https://mail.yahoo.com/',
		'yahoo.de': 'https://mail.yahoo.com/',
		'gmx.de': 'https://www.gmx.net/mail/',
		'gmx.net': 'https://www.gmx.net/mail/',
		'web.de': 'https://web.de/mail/'
	};

	function openInboxUrl(email) {
		var domain = (email.split('@')[1] || '').trim().toLowerCase();
		return INBOX_URLS[domain] || null;
	}

	// Domains a typo check is worth running against. Short on purpose: this
	// is a suggestion, never a block, and a longer list starts matching
	// genuinely different providers as "close" to the wrong one.
	var KNOWN_DOMAINS = [
		'gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com',
		'yahoo.com', 'icloud.com', 'gmx.de', 'web.de', 't-online.de'
	];

	// Iterative Levenshtein distance. Domain labels only -- short enough that
	// the O(m*n) table is nothing to worry about.
	function editDistance(a, b) {
		var m = a.length, n = b.length, i, j;
		var d = [];
		for (i = 0; i <= m; i++) { d[i] = [i]; }
		for (j = 0; j <= n; j++) { d[0][j] = j; }
		for (i = 1; i <= m; i++) {
			for (j = 1; j <= n; j++) {
				var cost = a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1;
				d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
			}
		}
		return d[m][n];
	}

	// A close-but-not-exact match against KNOWN_DOMAINS, or null. Distance <=
	// 2 catches "gmial.com"/"gmail.co" without flagging domains that are
	// genuinely different -- tighter and it misses real typos, looser and
	// "gmx.de" starts suggesting "gmail.com".
	function suggestDomain(email) {
		var at = email.indexOf('@');
		if (at < 0) { return null; }
		var domain = email.slice(at + 1).trim().toLowerCase();
		if (!domain || KNOWN_DOMAINS.indexOf(domain) !== -1) { return null; }
		var best = null, bestDist = 3;
		for (var i = 0; i < KNOWN_DOMAINS.length; i++) {
			var dist = editDistance(domain, KNOWN_DOMAINS[i]);
			if (dist > 0 && dist < bestDist) { bestDist = dist; best = KNOWN_DOMAINS[i]; }
		}
		return best ? email.slice(0, at + 1) + best : null;
	}

	// subscribe form -- posts to the funnel API's JSON list endpoint, which
	// always answers with {ok:true} and never redirects, so the page is
	// updated in place rather than navigated. `topics` goes over as one
	// comma-joined string: the API stringifies JSON values before parsing them,
	// so a real array would arrive as its Python repr.
	function subscribeForms() {
		$('.subscribe-form').each(function () {
			var $form = $(this);
			var $status = $form.find('.subscribe-status');
			var $email = $form.find('input[name="email"]');
			var $consent = $form.find('.consent-input');
			var $submit = $form.find('button[type="submit"]');
			var $typoHint = $form.find('.subscribe-typo-hint');
			var $done = $form.find('.subscribe-done');
			var endpoint = $form.data('subscribe-endpoint');

			// A suggestion, never a gate: it shows on blur (not every
			// keystroke, which would flicker mid-type) and a click on it
			// fills in the corrected address without submitting anything.
			$email.on('blur', function () {
				var suggestion = suggestDomain(($email.val() || '').trim());
				if (!suggestion) {
					$typoHint.attr('hidden', true).empty();
					return;
				}
				var template = $form.data('msg-typo') || '';
				var $link = $('<button type="button" class="subscribe-typo-fix"></button>').text(suggestion);
				$typoHint.empty().removeAttr('hidden');
				// The template is "Did you mean %s?" -- split on the one
				// placeholder so the suggestion can be a real clickable
				// element rather than text the visitor has to retype.
				var parts = template.split('%s');
				$typoHint.append(document.createTextNode(parts[0] || ''));
				$typoHint.append($link);
				$typoHint.append(document.createTextNode(parts[1] || ''));
				$link.on('click', function () {
					$email.val(suggestion);
					$typoHint.attr('hidden', true).empty();
					$email.trigger('focus');
				});
			});

			// "Wrong address? Change it" -- the field was never cleared on
			// success (see the success branch below), so restoring it is
			// just undoing the CSS state, not rebuilding the form.
			$done.find('.subscribe-done-edit').on('click', function () {
				$form.removeClass('is-done');
				$form.find('.beat-input, .consent-input').prop('disabled', false);
				$submit.prop('disabled', false);
				$email.prop('disabled', false).trigger('focus');
			});

			$form.on('submit', function (e) {
				e.preventDefault();
				var email = ($email.val() || '').trim();
				if (!email) {
					return;
				}
				// Consent is checked here as well as by the `required`
				// attribute, because the form carries `novalidate` -- without
				// this the browser would submit an unticked box straight past
				// the only opt-in record there is.
				if ($consent.length && !$consent.prop('checked')) {
					$status.addClass('text-danger').text($form.data('msg-consent'));
					$consent.trigger('focus');
					return;
				}

				var topics = $form.find('.beat-input:checked').map(function () {
					return this.value;
				}).get().join(',');

				$submit.prop('disabled', true);
				$status.removeClass('text-danger subscribe-status--success').text('');

				// Generated before the request so the pixel below and the
				// server both report this one action under the same id.
				var id = eventId();
				// Read before the request too: whether this visitor has signed
				// up before decides if the pixel fires, and the success branch
				// sets that flag itself.
				var subscribedBefore = recall(STORE_SUBSCRIBED);
				// A refusal suppresses the ad identifiers at the source, not
				// just their forwarding. The server would decline to report
				// them anyway, but it stores what it is sent -- and sending a
				// marketing cookie from a visitor who declined marketing is
				// the collection they declined, wherever it stops afterwards.
				var consented = adsConsent() === 'yes';

				fetch(endpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify($.extend({}, utmTags(), {
						email: email,
						topics: topics,
						consent: $consent.prop('checked') ? 'yes' : '',
						source_url: window.location.href,
						event_id: id,
						fbp: consented ? cookie('_fbp') : '',
						fbc: consented ? clickId() : '',
						ads_consent: consented ? 'yes' : ''
					}))
				}).then(function (res) {
					if (res.ok) {
						// The API answers identically whether the address was
						// new, pending or already on the list -- deliberately,
						// so it is not a membership oracle. The browser
						// therefore cannot tell a real signup from a resubmit,
						// and reporting one would send a conversion the server
						// matched nothing to, under an id nothing shares. This
						// local flag is the only honest signal available.
						if (!subscribedBefore && typeof fbq === 'function') {
							fbq('track', 'Subscribe', {
								content_name: 'BriefTechNews Daily Digest'
							}, { eventID: id });
						}
						// Same "first time only" guard as the pixel above, and the
						// same reason: gtag only exists once the consent banner has
						// loaded it, so an untyped check would just silently no-op --
						// this also requires the conversion label, which stays empty
						// (see hugo.toml) until the conversion action exists in the
						// Google Ads UI.
						var adsId = $form.data('google-ads-id');
						var adsLabel = $form.data('google-ads-label');
						if (!subscribedBefore && typeof gtag === 'function' && adsId && adsLabel) {
							gtag('event', 'conversion', { send_to: adsId + '/' + adsLabel });
						}
						// The status line stays (screen readers already announce
						// it via aria-live) but the done panel is the visible
						// surface now: it names the actual address typed and
						// says what has to happen next, rather than one line
						// easy to read as "you're finished".
						$status.addClass('subscribe-status--success').text($form.data('msg-pending'));
						$done.find('.subscribe-done-email').text(email);
						var inboxUrl = openInboxUrl(email);
						var $open = $done.find('.subscribe-done-open');
						if (inboxUrl) {
							$open.attr('href', inboxUrl).removeAttr('hidden');
						} else {
							$open.attr('hidden', true);
						}
						$typoHint.attr('hidden', true).empty();
						// The field is deliberately NOT cleared -- "Wrong
						// address? Change it" restores exactly what was typed.
						$email.prop('disabled', true);
						$submit.prop('disabled', true);
						$form.find('.beat-input, .consent-input').prop('disabled', true);
						$form.addClass('is-done');
						remember(STORE_SUBSCRIBED, '1');
					} else if (res.status === 422) {
						$status.addClass('text-danger').text($form.data('msg-invalid'));
						$submit.prop('disabled', false);
					} else {
						$status.addClass('text-danger').text($form.data('msg-error'));
						$submit.prop('disabled', false);
					}
				}).catch(function () {
					$status.addClass('text-danger').text($form.data('msg-error'));
					$submit.prop('disabled', false);
				});
			});
		});
	}
	subscribeForms();

	// Exit-intent newsletter dialog.
	//
	// Shown at most once per page load, never to someone who has subscribed or
	// dismissed it recently, and never in the first few seconds -- a dialog
	// that opens before the visitor has read anything is asking for a decision
	// they have no basis to make yet.
	function newsletterModal() {
		var $modal = $('#newsletter-modal');
		if (!$modal.length || recall(STORE_SUBSCRIBED)) {
			return;
		}
		var dismissedUntil = parseInt(recall(STORE_DISMISSED) || '0', 10);
		if (dismissedUntil && Date.now() < dismissedUntil) {
			return;
		}

		var settings = $modal.data();
		var armAfterMs = (settings.armAfter || 12) * 1000;
		var dismissDays = settings.dismissDays || 30;
		var opened = false;
		var armed = false;
		var lastFocus = null;

		setTimeout(function () { armed = true; }, armAfterMs);

		function open() {
			if (opened || !armed) {
				return;
			}
			opened = true;
			lastFocus = document.activeElement;
			$modal.prop('hidden', false);
			$('body').addClass('newsletter-modal-open');
			// Focus the field the dialog exists for, not the close button.
			$modal.find('input[type="email"]').trigger('focus');
		}

		function close() {
			if (!opened) {
				return;
			}
			opened = false;
			$modal.prop('hidden', true);
			$('body').removeClass('newsletter-modal-open');
			remember(STORE_DISMISSED, String(Date.now() + dismissDays * 86400000));
			if (lastFocus && lastFocus.focus) {
				lastFocus.focus();
			}
		}

		$modal.on('click', '[data-newsletter-dismiss]', close);
		$(document).on('keydown', function (e) {
			if (opened && (e.key === 'Escape' || e.keyCode === 27)) {
				close();
			}
		});

		// Keep Tab inside the dialog while it is open. Without this the focus
		// ring walks off into the page behind it, which for a screen reader is
		// indistinguishable from the dialog having closed.
		$modal.on('keydown', function (e) {
			if (!opened || (e.key !== 'Tab' && e.keyCode !== 9)) {
				return;
			}
			var $targets = $modal.find('a[href], button, input, select, textarea')
				.filter(':visible').not('[disabled]');
			if (!$targets.length) {
				return;
			}
			var first = $targets[0];
			var last = $targets[$targets.length - 1];
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		});

		// Desktop: the pointer leaving through the top of the viewport, which
		// is the tab bar and the address bar.
		$(document).on('mouseout', function (e) {
			if (!e.relatedTarget && !e.toElement && e.clientY <= 0) {
				open();
			}
		});

		// Touch devices have no pointer to leave, so the equivalent signal is
		// someone who has read most of the page and then flicks back upward --
		// the gesture that precedes reaching for the back button.
		var lastY = window.pageYOffset;
		var deepest = 0;
		$(window).on('scroll', function () {
			var y = window.pageYOffset;
			var height = document.documentElement.scrollHeight - window.innerHeight;
			deepest = Math.max(deepest, height > 0 ? y / height : 0);
			if (deepest > 0.5 && lastY - y > 220) {
				open();
			}
			lastY = y;
		});
	}
	newsletterModal();

	//post slider
	$('.post-slider').slick({
		slidesToShow: 1,
		slidesToScroll: 1,
		autoplay: true,
		autoplaySpeed: 1500,
		fade: true,
  	cssEase: 'linear',
		dots: false,
		arrows: true,
		prevArrow: '<button type=\'button\' class=\'prevArrow\'><i class=\'fas fa-angle-left\'></i></button>',
		nextArrow: '<button type=\'button\' class=\'nextArrow\'><i class=\'fas fa-angle-right\'></i></button>'
	});
	

})(jQuery);