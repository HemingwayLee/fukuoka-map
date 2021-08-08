;(function($){
  "use strict";

  $.fn.fukuokaMap = function(options) {
    var target = $(this);

    // Change null to undefined
    for (var option in options) {
      if (options.hasOwnProperty(option) && options[option] == null) {
        options[option] = undefined;
      }
    }

    // extend the original `options` object
    options = $.extend({
      width          : null,          // Canvas will be scaled to larger one of "width" and "height".
      height         : null,
      color          : "#a0a0a0",     // Default color, which used if no color is set in "areas" object.
      hoverColor     : null,          // If null, "color" will be 20% brightened when hovered.
      backgroundColor: "transparent", // Background color of the element, like "canvas".
      borderLineColor: "#ffffff",     // Border Line of Kus.
      borderLineWidth: 0.25,
      lineColor      : "#a0a0a0",     // Border Line of the element and the partition line when "movesIsland" is true.
      lineWidth      : 1,
      drawsBoxLine   : true,
      areas          : definition_of_fukuoka,
      font           : "Arial",
      fontSize       : 22,
      fontColor      : "#000000",
      onSelect       : function(){},
      onHover        : function(){}
    }, options);

    var map = new MapCanvas(options);
    target.append(map.element);
    map.render();   // IE and Safari doesn't render properly when rendered before appending to the parent.
    map.addEvent(); // iPad 1st + iOS5 doesn't work if this sentence is put before "target.append".

    return target;
  };

  // ---------------------------------------------------------------------------------------------------------------
  // Just for polyfill.
  // ---------------------------------------------------------------------------------------------------------------
  if (!('indexOf' in Array.prototype)) {
    Array.prototype.indexOf= function(find, i) {
      if (i===undefined) i= 0;
      if (i<0) i+= this.length;
      if (i<0) i= 0;
      for (var n= this.length; i<n; i++)
        if (i in this && this[i]===find)
          return i;
      return -1;
    };
  }
  if (!('forEach' in Array.prototype)) {
    Array.prototype.forEach= function(action, that) {
      for (var i= 0, n= this.length; i<n; i++)
        if (i in this)
          action.call(that, this[i], i, this);
    };
  }
  if (!('map' in Array.prototype)) {
    Array.prototype.map= function(mapper, that) {
      var other= new Array(this.length);
      for (var i= 0, n= this.length; i<n; i++)
        if (i in this)
          other[i]= mapper.call(that, this[i], i, this);
      return other;
    };
  }
  if (!('filter' in Array.prototype)) {
    Array.prototype.filter= function(filter, that) {
      var other= [], v;
      for (var i=0, n= this.length; i<n; i++)
        if (i in this && filter.call(that, v= this[i], i, this))
          other.push(v);
      return other;
    };
  }
  // ---------------------------------------------------------------------------------------------------------------
  // I guess "Cross-browser" may be a word of fantasy...
  // https://w3g.jp/blog/studies/touches_events
  // http://stackoverflow.com/questions/8751479/javascript-detect-metro-ui-version-of-ie
  // ---------------------------------------------------------------------------------------------------------------
  var _ua = (function(){
    return {
      Touch : typeof document.ontouchstart !== "undefined",
      Pointer : window.navigator.pointerEnabled,
      MSPointer : window.navigator.msPointerEnabled
    }
  })();

  var isWinDesktop = (function(){
    var supported = null;
    try {
      supported = !!new ActiveXObject("htmlfile");
    } catch (e) {
      supported = false;
    }
    return supported;
  })();

  var _start = _ua.Pointer ? 'pointerdown'  : _ua.MSPointer ? 'MSPointerDown'  : _ua.Touch ? 'touchstart' : 'mousedown' ;
  var _move  = _ua.Pointer ? 'pointermove'  : _ua.MSPointer ? 'MSPointerMove'  : _ua.Touch ? 'touchmove'  : 'mousemove' ;
  var _end   = _ua.Pointer ? 'pointerup'  : _ua.MSPointer ? 'MSPointerUp'  : _ua.Touch ? 'touchend'   : 'mouseup'   ;
  var _enter = _ua.Pointer ? 'pointerenter' : _ua.MSPointer ? 'MSPointerEnter' : _ua.Touch ? 'touchenter' : 'mouseenter';
  var _leave = _ua.Pointer ? 'pointerleave' : _ua.MSPointer ? 'MSPointerLeave' : _ua.Touch ? 'touchleave' : 'mouseleave';

  // ---------------------------------------------------------------------------------------------------------------
  // Base Class
  // ---------------------------------------------------------------------------------------------------------------
  var Map = function(options){
    this.options = options;
    this.base = {width:750, height:900};
    this.fitSize();
    this.initializeData();
  };

  Map.prototype.initializeData = function(){
    this.setData(null,null);
  };

  Map.prototype.setData = function(ku,area){
    this.data = {
      code : ku ? ku.code : null,
      name : ku ? ku.name : null,
      area : area ? area : null
    };
  };

  Map.prototype.hasData = function(){
    return this.data && this.data.code && this.data.code !== null;
  };

  Map.prototype.fitSize = function(){
    this.size = {};

    if (! this.options.width && ! this.options.height){
      this.options.width  = this.base.width;
      this.options.height = this.base.height;

    } else if (this.options.width && ! this.options.height) {
      this.options.height = this.base.height * this.options.width  / this.base.width;

    } else if (! this.options.width && this.options.height) {
      this.options.width  = this.base.width  * this.options.height / this.base.height;
    }

    if (this.options.height / this.options.width > this.base.height / this.base.width){
      this.size.width  = this.options.width;
      this.size.height = this.options.width  * this.base.height / this.base.width;
    } else {
      this.size.width  = this.options.height * this.base.width  / this.base.height;
      this.size.height = this.options.height;
    }
  };

  Map.prototype.addEvent = function(){
    var self = this;
    var _target = $(this.element);

    if (_ua.Pointer && ! isWinDesktop || _ua.MSPointer && ! isWinDesktop || _ua.Touch){

      if (_ua.Pointer || _ua.MSPointer){
        _target.css("-ms-touch-action", "none").css("touch-action", "none");
      }

      _target.on(_start, function(e){
        var point  = e.originalEvent.changedTouches ? e.originalEvent.changedTouches[0] : e;

        self.pointer = {
          x: point.pageX - _target[0].offsetLeft,
          y: point.pageY - _target[0].offsetTop
        };
        self.render();
        if (self.isHovering()) {
          e.preventDefault();
          e.stopPropagation();
        }

        _target.on(_move, function(e){
          point	= e.originalEvent.changedTouches ? e.originalEvent.changedTouches[0] : e;

          if (self.isHovering()) {
            self.pointer = {
              x: point.pageX - _target[0].offsetLeft,
              y: point.pageY - _target[0].offsetTop
            };

            self.render();
            e.preventDefault();
            e.stopPropagation();
          }
        });

        $(document).on(_end, function(e){
          point	= e.originalEvent.changedTouches ? e.originalEvent.changedTouches[0] : e;

          if (self.data.code !== null && self.data.name != null && "onSelect" in self.options){
            setTimeout(function(){
              self.options.onSelect(self.data);
            } ,0);
          }
          self.pointer = null;

          _target.off(_move);
          $(document).off(_end);
        });
      });


    } else {

      _target.on("mousemove", function(e){
        var point  = e.originalEvent.changedTouches ? e.originalEvent.changedTouches[0] : e;

        self.pointer = {
          x: point.pageX - _target[0].offsetLeft,
          y: point.pageY - _target[0].offsetTop
        };
        self.render();

      });

      _target.on("mousedown", function(e){
        var point	= e.originalEvent.changedTouches ? e.originalEvent.changedTouches[0] : e;

        if (self.data.code !== null && self.data.name != null && "onSelect" in self.options){
          setTimeout(function(){
            self.options.onSelect(self.data);
          } ,0);
        }
        self.pointer = null;
      });

      _target.on("mouseout", function(e){
        self.pointer = null;
        self.render();
      });
    }

  };

  Map.prototype.brighten = function(hex, lum) {
    hex = String(hex).replace(/[^0-9a-f]/gi, '');
    if (hex.length < 6) {
      hex = hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2];
    }
    lum = lum || 0;
    var rgb = "#", c, i;
    for (i = 0; i < 3; i++) {
      c = parseInt(hex.substr(i*2,2), 16);
      c = Math.round(Math.min(Math.max(0, parseInt(c + (c * lum))), 255)).toString(16);
      rgb += ("00"+c).substr(c.length);
    }
    return rgb;
  };

  // ---------------------------------------------------------------------------------------------------------------
  // Canvas 
  // ---------------------------------------------------------------------------------------------------------------
  var MapCanvas = function(){
    var available = !!document.createElement('canvas').getContext;
    if (! available){
      throw "Your browser may not support CANVAS.";
    }
    this.element = document.createElement("canvas");
    Map.apply(this, arguments);

    this.element.width  = this.size.width;
    this.element.height = this.size.height;
  };
  MapCanvas.prototype = Object.create(Map.prototype);
  MapCanvas.prototype.constructor = Map;

  MapCanvas.prototype.render = function(){
    var context = this.element.getContext("2d");
    context.clearRect( 0, 0, this.element.width, this.element.height );

    this.hovering = false;
    this.hovered  = null;

    var render = this.renderKuMap;
    render.apply(this);

    if (! this.hovering)
      this.initializeData();

    this.element.style.background = this.options.backgroundColor;

    if (this.options.drawsBoxLine){
      this.element.style.borderWidth = this.options.lineWidth + "px";
      this.element.style.borderColor = this.options.lineColor;
      this.element.style.borderStyle = "solid";
    }

    this.drawName();
  };

  MapCanvas.prototype.renderKuMap = function(){
    var context = this.element.getContext("2d");

    this.options.areas.kus.forEach(function(ku){

      context.beginPath();
      this.drawKu(ku);
      context.closePath();

      this.setProperties(ku,this.options.areas);

      context.fill();
      if (this.options.borderLineColor && this.options.borderLineWidth > 0)
        context.stroke();

    }, this);
  };

  MapCanvas.prototype.drawKu = function(ku){
    ku.path.forEach(function(p){
      var OFFSET =  {X:0, Y:0};
      if ("coords"  in p) this.drawCoords(p.coords, OFFSET);
      if ("subpath" in p){
        p.subpath.forEach(function(s){
          if ("coords" in s) this.drawCoords(s.coords, OFFSET);
        }, this);
      }
    }, this);
  };

  MapCanvas.prototype.drawName = function(){
    this.options.areas.kus.forEach(function(ku){
      var center = this.getCenterOfKu(ku);
      this.drawText(ku, center);
    }, this);
  };

  MapCanvas.prototype.drawText = function(ku_or_area, point){
    var context = this.element.getContext("2d");
    var area = ku_or_area;

    context.save();

    if (this.options.fontColor && this.options.fontColor == "areaColor"){
      var hovered = this.hovered == area.code;
      var color   = area.color? area.color : this.options.color;
      var hvColor = area.color && area.hoverColor ?
        area.hoverColor :
        area.color?
          this.brighten(area.color, 0.2) :
          this.options.hoverColor? this.options.hoverColor : this.brighten(this.options.color, 0.2);

      context.fillStyle = hovered ? hvColor : color;
    } else if (this.options.fontColor) {
      context.fillStyle = this.options.fontColor;
    } else {
      context.fillStyle = this.options.color;
    }

    context.font = (this.options.fontSize? this.options.fontSize : this.element.width / 100) + "px '" + (this.options.font? this.options.font : "Arial") + "'";
    context.textAlign = 'center';
    context.textBaseline = 'middle';

    for (var i = 0; i < 5; i++)
      context.fillText(ku_or_area.name, point.x * this.element.width / this.base.width, point.y * this.element.height / this.base.height);
    context.restore();
  };


  MapCanvas.prototype.getCenterOfKu = function(ku){
    var center = {x:0, y:0, n:0};

    var OFFSET =  {X:0, Y:0};
    switch (ku.name){
      case "北海道"  : OFFSET.X = 10; OFFSET.Y = -5; break;
    }

    var path = ku.path[0];
    if ("coords"  in path) {
      var i = 0;
      while(true){
        var x = path.coords[i * 2 + 0];
        var y = path.coords[i * 2 + 1];
        if (typeof x === "undefined" || typeof y === "undefined") break;

        x = x + OFFSET.X;
        y = y + OFFSET.Y;

        center.n ++;
        center.x = (center.x * (center.n - 1) + x) / center.n;
        center.y = (center.y * (center.n - 1) + y) / center.n;
        i++;
      }
    }
    return center;
  };


  MapCanvas.prototype.drawCoords = function(coords, OFFSET){
    var context = this.element.getContext("2d");
    var i = 0;
    while(true){
      var x = coords[i * 2 + 0];
      var y = coords[i * 2 + 1];
      if (typeof x === "undefined" || typeof y === "undefined") break;

      x = x + OFFSET.X;
      y = y + OFFSET.Y;

      if(i==0) {
        context.moveTo( x * this.element.width / this.base.width, y * this.element.height / this.base.height );
      } else {
        context.lineTo( x * this.element.width / this.base.width, y * this.element.height / this.base.height );
      }
      i++;
    }
  };

  MapCanvas.prototype.setProperties = function(ku, area){
    var context = this.element.getContext("2d");
    context.fillStyle = ("color" in area)? area.color : this.options.color;

    if (this.options.borderLineColor)
      context.strokeStyle = this.options.borderLineColor;

    if (this.options.borderLineWidth)
      context.lineWidth = this.options.borderLineWidth;

    var pointerIsOn = this.pointer && context.isPointInPath( this.pointer.x, this.pointer.y );

    if (pointerIsOn){
      this.hovering = true;
      this.hovered  = ku.code;

      this.setData(ku,area);
      if (this.data.code != ku.code && this.options.onHover){
        this.options.onHover(this.data);
      }

      if (area.hoverColor)
        context.fillStyle = area.hoverColor;
      else if (this.options.hoverColor)
        context.fillStyle = this.options.hoverColor;
      else
        context.fillStyle = this.brighten(context.fillStyle, 0.2);
    }

    this.element.style.cursor = (this.data.code == null)? "default" : "pointer";
  };

  MapCanvas.prototype.isHovering = function(){
    return this.hovering;
  };

  // ---------------------------------------------------------------------------------------------------------------
  /* data */
  var definition_of_fukuoka = {
    "code" : 0,
    "name" : "福岡",
    "color": "#a0a0a0",
    "kus"  : [
      {
        "code" : 1,
        "name" : "西区",
        "path" : [
          {
            "coords" : [55,178,56,206,62,214,57,228,49,235,40,233,41,246,59,288,60,313,51,328,57,365,69,380,61,407,77,418,115,420,131,432,122,477,132,488,149,488,153,478,162,479,178,496,217,514,238,537,238,552,247,559,247,591,237,608,252,626,265,624,271,631,280,629,292,611,320,592,317,530,327,490,323,476,331,466,329,445,336,425,360,413,367,400,363,368,333,364,333,375,326,375,324,364,301,365,295,373,297,393,266,412,251,413,239,406,237,412,222,412,204,406,191,390,193,382,189,377,179,377,178,383,158,370,135,380,151,363,184,353,190,359,188,364,196,370,202,370,208,355,216,347,211,341,214,333,209,326,193,322,183,328,159,328,114,314,116,308,112,305,112,300,109,294,109,288,95,265,98,256,104,255,109,252,105,250,108,243,113,243,117,238,122,234,126,225,124,219,115,217,112,206,89,194,78,185,70,181,69,177,62,174]
          },{
            "name" : "玄界島",
            "coords" : [95,109,98,100,107,98,117,99,127,108,127,129,121,131,113,132,104,120]
          },{
            "name" : "能古島",
            "coords" : [266,263,270,288,265,307,259,312,259,322,263,327,264,333,268,339,278,340,280,337,290,336,293,331,290,327,296,328,298,319,302,318,301,313,305,311,301,306,302,296,288,278,287,273,288,261,282,255,274,254]
          }
        ]
      },
      {
        "code" : 2,
        "name" : "早良区",
        "path" : [
          {
            "coords" : [237,608,252,626,265,624,271,631,280,629,292,611,320,592,317,530,327,490,323,476,331,466,329,445,336,425,360,413,367,400,372,408,371,402,373,398,377,372,388,371,399,369,421,413,411,458,397,461,390,496,371,535,386,548,399,550,412,583,411,592,408,602,431,621,449,647,466,684,477,761,506,799,489,808,482,811,483,831,489,840,488,856,454,861,447,857,424,829,395,830,385,824,377,817,338,765,303,760,209,715,207,705,208,655,210,637]
          }
        ]
      },
      {
        "code" : 3,
        "name" : "城南区",
        "path" : [
          {
            "coords" : [421,413,411,458,397,461,390,496,371,535,386,548,399,550,412,583,411,592,430,595,443,582,456,569,454,554,466,542,460,491,445,465,445,431,432,413]
          }
        ]
      },
      {
        "code" : 4,
        "name" : "南区",
        "path" : [
          {
            "coords" : [431,621,408,602,411,592,430,595,443,582,456,569,454,554,466,542,460,491,470,490,480,498,496,489,488,461,499,451,513,453,537,427,555,433,575,454,581,480,591,481,616,506,616,512,596,534,595,542,592,552,591,559,598,588,585,580,573,568,556,563,547,565,536,578,521,590,506,602,492,614,485,620,469,619,464,613,459,610,452,611,444,619]
          }
        ]
      },
      {
        "code" : 5,
        "name" : "中央区",
        "path" : [
          {
            "coords" : [399,369,421,413,432,413,445,431,445,465,460,491,470,490,480,498,496,489,488,461,499,451,513,453,537,427,524,407,524,394,520,385,504,377,499,362,490,362,493,356,491,351,487,350,479,333,467,339,473,354,464,359,473,363,483,364,469,374,459,375,454,368,463,368,460,361,456,360,458,352,450,351,450,346,440,346,437,356,432,355,423,357,414,360,417,367,411,366]
          }
        ]
      },
      {
        "code" : 6,
        "name" : "博多区",
        "path" : [
          {
            "coords" : [537,427,524,407,524,394,520,385,504,377,499,362,492,345,499,347,504,346,502,342,492,332,498,325,517,337,531,337,538,336,561,319,597,315,624,306,621,323,639,347,655,371,656,381,648,387,646,394,653,414,674,432,691,460,688,485,670,487,656,479,650,487,660,497,667,504,659,524,652,524,623,515,616,512,616,506,591,481,581,480,575,454,555,433]
          }
        ]
      },
      {
        "code" : 7,
        "name" : "東区",
        "path" : [
          {
            "coords" : [517,337,531,337,538,336,561,319,597,315,624,306,629,279,645,269,659,258,668,259,675,265,703,266,706,247,703,241,694,231,679,216,666,198,655,182,657,160,653,152,638,148,625,142,623,133,619,110,614,103,602,90,587,81,541,60,538,66,539,73,535,76,522,93,515,92,511,95,513,101,503,116,488,127,474,138,457,151,442,160,422,169,400,178,391,178,380,186,367,190,352,192,338,193,326,192,317,190,309,187,305,178,307,175,302,169,303,162,300,159,300,152,295,141,289,134,286,132,285,125,282,118,276,116,270,113,262,113,257,117,249,117,248,125,239,136,240,142,245,146,245,154,248,165,253,174,257,182,262,185,265,192,294,197,297,193,300,188,305,190,313,193,320,195,329,197,337,201,339,207,348,222,360,217,367,218,374,224,384,226,397,238,410,239,414,231,409,230,408,221,408,213,410,201,414,195,420,190,426,185,427,180,450,174,482,169,498,164,515,149,507,141,513,133,527,126,531,128,542,124,543,119,566,120,568,116,577,133,573,145,565,148,562,150,568,165,571,173,580,180,581,186,578,194,563,192,544,201,515,217,517,222,534,228,538,224,550,226,556,242,582,259,597,271,577,264,572,269,573,290,569,270,566,256,558,250,553,249,526,239,520,243,512,263,523,270,521,274,514,279,509,294,527,303,533,310,513,306,505,310,502,319,515,329]
          },{
            "name" : "福岡アイランドシティ",
            "coords" : [489,182,487,187,493,199,508,193,512,199,532,191,533,194,537,193,541,197,561,189,566,181,561,167,559,161,550,151,538,150,520,162,515,166,506,173]
          }
        ]
      }
    ]
  };

  // var definition_of_english_name = {
  //   1: "Nishi", 2: "Sawara", 3: "Jonan", 4: "Minami", 5: "Chuo", 6: "Hakata", 7: "Higashi"
  // };

})(jQuery);