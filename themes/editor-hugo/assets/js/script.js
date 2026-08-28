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


	// subscribe form -- posts to the funnel API's JSON list endpoint, which
	// always answers with {ok:true} and never redirects, so the page is
	// updated in place rather than navigated.
	function subscribeForms() {
		$('.subscribe-form').each(function () {
			var $form = $(this);
			var $status = $form.find('.subscribe-status');
			var $email = $form.find('input[name="email"]');
			var endpoint = $form.data('subscribe-endpoint');

			$form.on('submit', function (e) {
				e.preventDefault();
				var email = ($email.val() || '').trim();
				if (!email) {
					return;
				}
				$form.find('button[type="submit"]').prop('disabled', true);
				$status.removeClass('text-danger').text('');

				fetch(endpoint, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: email, source_url: window.location.href })
				}).then(function (res) {
					if (res.ok) {
						$status.text($form.data('msg-pending'));
						$email.val('').prop('disabled', true);
						$form.find('button[type="submit"]').prop('disabled', true);
					} else if (res.status === 422) {
						$status.addClass('text-danger').text($form.data('msg-invalid'));
						$form.find('button[type="submit"]').prop('disabled', false);
					} else {
						$status.addClass('text-danger').text($form.data('msg-error'));
						$form.find('button[type="submit"]').prop('disabled', false);
					}
				}).catch(function () {
					$status.addClass('text-danger').text($form.data('msg-error'));
					$form.find('button[type="submit"]').prop('disabled', false);
				});
			});
		});
	}
	subscribeForms();

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