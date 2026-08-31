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
			var endpoint = $form.data('subscribe-endpoint');

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
				$status.removeClass('text-danger').text('');

				fetch(endpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						email: email,
						topics: topics,
						consent: $consent.prop('checked') ? 'yes' : '',
						source_url: window.location.href
					})
				}).then(function (res) {
					if (res.ok) {
						$status.text($form.data('msg-pending'));
						$email.val('').prop('disabled', true);
						$submit.prop('disabled', true);
						$form.find('.beat-input, .consent-input').prop('disabled', true);
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