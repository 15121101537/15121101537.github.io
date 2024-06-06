/*!
 * fancyBox - jQuery Plugin
 * version: 2.1.5 (Thu, 03 Jan 2013)
 * @requires jQuery v1.6 or later
 *
 * Examples at http://fancyapps.com/fancybox/
 * License: www.fancyapps.com/fancybox/#license
 *
 * Copyright 2012 fancyapps.com
 *
 */
(function (window, document, $, undefined) {
  "use strict";

  var H = $("html"),
    W = $(window),
    D = $(document),
    F = $.fancybox = function () {
      F.open.apply(this, arguments);
    },
    didUpdate = false,
    isTouch = document.createTouch !== undefined,
    isQuery = function (o) {
      return o && o.hasOwnProperty && o instanceof $;
    },
    isString = function (o) {
      return o && $.type(o) === "string";
    },
    isPercentage = function (n) {
      return n && $.type(n) === "string" && n.indexOf('%') > 0;
    },
    isScrollable = function (el) {
      return (
        el &&
        $(el).css('overflow-y') === 'auto' &&
        el.scrollHeight > el.clientHeight
      );
    },
    getScalar = function (orig, dim) {
      return Math.round(parseFloat(orig) / 100 * dim);
    },
    getValue = function (value, dim) {
      return getScalar(value, dim) + 'px';
    };

  $.extend(F, {
    version: '2.1.5',
    defaults: {
      padding: 15,
      margin: 20,
      width: 800,
      height: 600,
      minWidth: 100,
      minHeight: 100,
      maxWidth: 9999,
      maxHeight: 9999,
      pixelRatio: 1,
      autoSize: true,
      autoHeight: false,
      autoWidth: false,
      autoResize: !isTouch,
      autoCenter: !isTouch,
      fitToView: true,
      aspectRatio: false,
      topRatio: 0.5,
      leftRatio: 0.5,
      scrolling: 'auto',
      wrapCSS: '',
      arrows: true,
      closeBtn: true,
      closeClick: false,
      nextClick: false,
      mouseWheel: true,
      autoPlay: false,
      playSpeed: 3000,
      preload: 3,
      modal: false,
      loop: true,
      ajax: {
        dataType: 'html',
        headers: { 'X-fancyBox': true }
      },
      iframe: {
        scrolling: 'auto',
        preload: true
      },
      swf: {
        wmode: 'transparent',
        allowfullscreen: 'true',
        allowscriptaccess: 'always'
      },
      keys: {
        next: {
          13: 'left', // enter
          34: 'up', // page down
          39: 'left', // right arrow
          40: 'up' // down arrow
        },
        prev: {
          8: 'right', // backspace
          33: 'down', // page up
          37: 'right', // left arrow
          38: 'down' // up arrow
        },
        close: [27], // escape key
        play: [32], // space - start/stop slideshow
        toggle: [70] // letter "f" - toggle fullscreen
      },
      direction: {
        next: 'left',
        prev: 'right'
      },
      scrollOutside: true,
      index: 0,
      type: null,
      href: null,
      content: null,
      title: null,
      tpl: {
        wrap: '<div class="fancybox-wrap" tabIndex="-1"><div class="fancybox-skin"><div class="fancybox-outer"><div class="fancybox-inner"></div></div></div></div>',
        image: '<img class="fancybox-image" src="{href}" alt="" />',
        iframe: '<iframe class="fancybox-iframe" name="fancybox-frame{rnd}" frameborder="0" hspace="0" ' +
          'scrolling="{scrolling}" ' +
          'src="{href}"></iframe>',
        error: '<p class="fancybox-error">The requested content cannot be loaded.<br/>Please try again later.</p>',
        closeBtn: '<a title="Close" class="fancybox-item fancybox-close" href="javascript:;"></a>',
        next: '<a title="Next" class="fancybox-nav fancybox-next" href="javascript:;"><span></span></a>',
        prev: '<a title="Previous" class="fancybox-nav fancybox-prev" href="javascript:;"><span></span></a>'
      },
      openEffect: 'fade',
      openSpeed: 250,
      openEasing: 'swing',
      openOpacity: true,
      openMethod: 'zoomIn',
      closeEffect: 'fade',
      closeSpeed: 250,
      closeEasing: 'swing',
      closeOpacity: true,
      closeMethod: 'zoomOut',
      nextEffect: 'elastic',
      nextSpeed: 250,
      nextEasing: 'swing',
      nextMethod: 'changeIn',
      prevEffect: 'elastic',
      prevSpeed: 250,
      prevEasing: 'swing',
      prevMethod: 'changeOut',
      helpers: {
        overlay: true,
        title: true
      },
      onCancel: $.noop,
      beforeLoad: $.noop,
      afterLoad: $.noop,
      beforeShow: $.noop,
      afterShow: $.noop,
      beforeChange: $.noop,
      beforeClose: $.noop,
      afterClose: $.noop
    }
  });

  // Shortcut for fancyBox
  $.fn.fancybox = function (options) {
    var index,
      that = $(this),
      selector = this.selector || '',
      run = function (e) {
        var what = $(this).blur(), idx = index, relType, relVal;
        if (!(e.ctrlKey || e.altKey || e.shiftKey || e.metaKey) && !what.is('.fancybox-wrap')) {
          e.preventDefault();
          relType = options.groupAttr || 'data-fancybox-group';
          relVal = what.attr(relType);
          if (!relVal) {
            index = $(selector).index(what);
            F.open(that, options);
          } else {
            F.open('[' + relType + '="' + relVal + '"]', options);
          }
        }
      };
    options = options || {};
    index = options.index || 0;
    if (!selector || options.live === false) {
      that.unbind('click.fb-start').bind('click.fb-start', run);
    } else {
      D.undelegate(selector, 'click.fb-start').delegate(selector + ":not('.fancybox-item, .fancybox-nav')", 'click.fb-start', run);
    }
    return this;
  };

  D.ready(function () {
    var w1, w2;
    if ($.scrollbarWidth === undefined) {
      $.scrollbarWidth = function () {
        var parent = $('<div style="width:50px;height:50px;overflow:auto"><div/></div>').appendTo('body'),
          child = parent.children(),
          width = child.innerWidth() - child.height(99).innerWidth();
        parent.remove();
        return width;
      };
    }
    if ($.support.fixedPosition === undefined) {
      $.support.fixedPosition = (function () {
        var elem = $('<div style="position:fixed;top:20px;"></div>').appendTo('body'),
          fixed = (elem[0].offsetTop === 20 || elem[0].offsetTop === 15);
        elem.remove();
        return fixed;
      }());
    }
    $.extend(F.defaults, {
      scrollbarWidth: $.scrollbarWidth(),
      fixed: $.support.fixedPosition,
      parent: $('body')
    });

    w1 = $(window).width();
    H.addClass('fancybox-lock-test');
    w2 = $(window).width();
    H.removeClass('fancybox-lock-test');

    $('<style type="text/css">.fancybox-margin{margin-right:' + (w2 - w1) + 'px;}</style>').appendTo('head');
  });

}(window, document, jQuery));
