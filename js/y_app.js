; 'use strict';

var ga;

if ( /github\.io/i.test(location.hostname) ) {
  (function(i,s,o,g,r,a,m){i['GoogleAnalyticsObject']=r;i[r]=i[r]||function(){
  (i[r].q=i[r].q||[]).push(arguments)},i[r].l=1*new Date();a=s.createElement(o),
  m=s.getElementsByTagName(o)[0];a.async=1;a.src=g;m.parentNode.insertBefore(a,m)
  })(window,document,'script','https://www.google-analytics.com/analytics.js','ga');

  ga( 'create', 'UA-79746991-1', 'auto', { anonymizeIp: true } );
}

/* This is an immediate function that wraps everything.  It initializes all of
 * the app constants and variables, and hooks window.onDOMContentLoaded to
 * {eDOMContent}. Inside of it the Panes module is defined, also an immediate
 * function.
 *
 * Many functions accept a content parameter.  On first load, this is the main
 * document div#content element.  After that, the parameter is the div#content
 * element in the documentFragment from the XHR request.  This is done so that
 * all document modifications / additions are done **before** the element
 * replaces the document element.  Simply put, faster rendering.
 * @js_module_new App
 */
(function(_t2Info, undefined) {

//{ Constants

/*### Constants */
var ST_VERS = '0.5.9',  // state version (local storage object)
    VERSION = '0.7.0';

/* #### Window Metrics */
var SML_MED = 110  ,    // char width 0 to 1 type
    MED_LRG = 160  ,    // char width 1 to 2 type
    ZOOM    =  95.0,    // char width for touch device zoom
    FS      =  15.0;    // default fontSize px30em

/* #### Size Metrics */
var  FLT_TOP =  4.0,   // Top of Floating Pane    em
     FLT_HGT =  4.5;   // Top + bottom (0.5 em)   em

/* #### Class Names */
var CN_CLICKED = 'clicked', // used for 'clicked' highlight
    CN_HIDDEN  = 'h',       // used with summaries, lists, & header buttons
    CN_WAIT    = 'w';       // shows wait cursor

/* #### Text Strings */
var T_VIEW_SRC = 'view source',
    T_HIDE_SRC = 'hide source';

/* #### clickedBy enumeration */
var CB_CONTENT   = 0,
    CB_OBJ_PATH  = 1,
    CB_LIST      = 2,
    CB_TOC       = 3,
    CB_POP_STATE = 4;

/* #### Valid List search characters */
var RE_LIST_SEARCH = /[a-z0-9$!%&\*\+\-\/<=>\?\[\]\^_\|\~]/i;

/* #### Pane Button ids */
var HDR_PANE_BTNS  = ['list_loc', 'list_vis', 'toc_loc', 'toc_vis'];

/* #### Pane KeyDown Test */
var WIN_PANE_KD    = 'cdlmpst'; // C-lass D-oc L-ist M-ethod P-roperties S-earch T-OC

//}

/*
t2Info.CSEP
t2Info.ISEP
*/


//{ Variables

/*### Variables */
var storage,  // set to localStorage, then sessionStorage
    state;    // Display state object

/* #### General Window Metrics & Data */
var cS = null,
    eContent,               // main content element
    winHeight = 0,          // current window height
    winWidth = 0,           // current window width
    fwHdrHgt = 0,
    winResizeTmrId = null,  // SetTimeout id for window.onresize
    winType = -1,           // 0 narrow, 1 medium, 2 wide
    winTitle = '',      // Title from <head><title>, used in history
    winZoom = null,     // FontSize in px if zoomed
    e25vh,              // 25vh wide the element
    px30em   = 0.0,     // 30em wide px
    px50Char = 0.0,     // 50 monospaced characters wide px
    waitWidth = 6.0;    // width of wait indicator

/* #### Clicked and Navigation */
var aDOMCur = document.createElement('a'),  // current window.location
    aDOMNext = document.createElement('a'), // next window.location
    clickedBy = -1,  // source of navigation click
    eContentClicked, // Element that is highlighted in main document
    clickedTop = 0,  // screenY coordinate of click (or clicked item)
    oXHRDoc,         // xhr object currently retrieving document
    oCSSRuleTable;

/* #### App State */
var isHttp = /^http(s)?:/.test(window.location.protocol),
    isFirstLoad = true,
    isServer = false,
    isTouch = 'ontouchstart' in document.documentElement,
    isVHBad = false,        // iOS Safari 100vh != innerHeight
    isWinHistory = ( window.hasOwnProperty('history') &&
                     window.history.pushState instanceof Function),
    isWinKPTimeOut = false,  // used to debounce long key presses
    isZoomed = false;        // Touch devices will zoom via FontSize

/*#### Debug flags & Objects */
var dbgDocTiming   = false, // logs doc load timing info to console, dbgDocLoad
    dbgDoc         = false, // logs doc info to console, dbgDocInfo
    dbgListTiming  = false, // logs list load timing info to console, dbgListLoad
    dbgListSplit   = false,
    dbgSearchLoad  = false,
    dbgSearchSplit = false,
    dbgYDebug      = false,  // use y_debug element
    oDbgDoc   = {},
    oDbgList  = {};

/*#### Objects created by Pane module */
var oPane, oList, oToc;

var LS_XHR_LOAD = 0,
    LS_RENDER = 1;

/*#### t2Opts (t2 Options) holds data from YARD and customization data */
  var docLoadState = { xhr: null, cbFunc: null, url: '', state: null },
      t2Opts = {
        NSEP: '',
        customHeaderId: '',
  };

//}

/* This code controls the 'List' and 'TOC' panes.  Exported functions are
 * detailed in the {__loadPublicState} function, which loads oPane, oList, & oToc.
 * All exported functions have an underscore in their name.
 *
 * Three objects are exported:
 * * oPane - functions that are common to (or affect) both oList & oToc
 * * oList - functions & properties specific to the 'List' pane
 * * oToc  - functions & properties specific to the 'TOC' pane
 *
 * The functions are grouped and named the same.
 * @js_module_new Panes
 */
(function() {

//{ Pane Constants & Variables

/*### Constants
 *#### Class Names */
var CN_DOCKED   = 'd',         // Used with nav & toc div elements (the panes)
    CN_FLOATING = 'f',
    CN_TOUCH    = ' t',
    CN_BTN_VIS  = 'vis',       // Used with list_vis & toc_vis button elements
    CN_CLOSED   = 'yl_closed'; // Used on list li elements that have buttons

/* #### Size Metrics - oList & oToc */
var LIST_MIN = 18.0   , // List pane min width      em
    LIST_MAX = 40.0   , // List pane max width      em
    LIST_HDR =  5.4000, // List pane header height  em
     TOC_MIN = 17.0   , // as above, but oToc
     TOC_MAX = 30.0   ,
     TOC_HDR =  3.5334,
     H_CLS   =  1.8667; // Height Class & oToc Item em

/* #### oList.type enumeration */
var LIST_CLASS    = 0,
    LIST_METHOD   = 1,
    LIST_PROPERTY = 2,
    LIST_FILE     = 3,
    LIST_UNKNOWN    = 4,
    // array must match enum, see listGetInfo
    LIST_ENUM = ['class', 'method', 'property', 'file', 'Unknown'];

/* #### TOC Generate Strings & RegEx */
var RE_METH_CLS  = /-class_method$/,
    RE_METH_INST = /-instance_method$/;


/*### Variables
 *#### Resizers start data */
var resizerStWid = 0,  // starting pane width
    resizerStX   = 0;  // mouseDown or TouchStart screenX

/* #### Metrics */
var winFloatingTop; // screenY of floating windows

/* List Search & Load */
var lastSearchText = '',
    oLoad = {},           // object to pass to listLoadSplit
    oSearches = [];       // array of search objects

//}

//{ @!group Public Interface

/* Binds reSize event handlers to oList & oToc
 * @param me [oList, oToc] this object
 */
function __bind(me) {
  me.resizeMD = resizeMD.bind(me);
  me.resizeMM = resizeMM.bind(me);
  me.resizeMU = resizeMU.bind(me);

  if (isTouch) {
    me.resizeTS = resizeTS.bind(me);
    me.resizeTM = resizeTM.bind(me);
    me.resizeTE = resizeTE.bind(me);
  }
};

/* Initialization - Loads public function properties into oList, oPane, and oToc,
 * loads state from storage.
 * @note This is loaded before the DOMContentLoaded event
 */
function __loadPublicState() {
  var version = '';

  try { storage = window.localStorage; } catch (e) {
    try { storage = window.sessionStorage; } catch (e) { };
  }

  if (storage && storage.yardState) {
    state = JSON.parse(storage.yardState);
    if (state.showSource === undefined)
      state.showSource = false;
    version = (state.version !== undefined ? state.version : '');
  }
  if (ST_VERS > version) {
    state = {
               'version': ST_VERS,
      'summaryCollapsed': 'collapse',
            'showSource': false,
               'display': [
        { 'list': { 'docked': false , 'vis': true  , 'width': 0 },
          'toc' : { 'docked': false , 'vis': false , 'width': 0 } },

        { 'widthDocked': 0,
          'list': { 'docked': true  , 'vis': true  , 'width': 0 },
          'toc' : { 'docked': false , 'vis': true  , 'width': 0 } },

        { 'list': { 'docked': true  , 'vis': true  , 'width': 0 },
          'toc' : { 'docked': true  , 'vis': true  , 'width': 0 } }
      ]
    };
    Object.seal(state);
    if (storage) storage.yardState = JSON.stringify(state);
  }

  oPane = {
    firstDOMLoad: _FirstDOMLoad,     // called by eDOMContent (first load)
         mainClk: pane_MainClk,      // called by clkHdrBtn
          mainKD: pane_MainKD,       // called by winKeyDown
          locSet: pane_LocSet        // called by domLayout
  };

  oList = { e: null, s: null, d: null, bLoc: null, bVis: null, nav: null,
           clickedA: null, clickedLI: null, clickedLIOld: null, items: null,
           isOpenClose: false,
             hdrHeight: 0,
      searchInfo: [],
         libRoot: '',
            type: LIST_UNKNOWN,
         itemQty: 0,
     itemsSearch: 0,
        itemsVis: 0,
        keyPress: list_KeyPress,
     searchClear: list_SearchClear,  // called by winKeyDown (Esc key)
     showClicked: list_ShowClicked,  // called by gotoHash & xhrCBDoc
           xhrCB: list_xhrCB         // called by xhrCBDoc & eDOMContent
  };

  oToc = { e: null, s: null, d: null, bLoc: null, bVis: null, nav: null,
           clickedA: null, clickedLI: null, clickedLIOld: null, items: null,
           isOpenClose: false,
             hdrHeight: 0,
      floatingOffset: null,
        generate: toc_Generate,      // called by addContent
     showClicked: toc_ShowClicked    // called by gotoHash
  };

  oLoad.isRunning = false;
  oLoad.cancel    = false;

  __bind(oList);
  __bind(oToc);
  Object.seal(oPane);
  Object.seal(oList);
  Object.seal(oToc);
  __bind = undefined;
};

//} @!endgroup

//{ @!group FirstDOMLoad Functions

/* Called **only** on first YARD document load */
function _FirstDOMLoad() {
  _CheckState();
  _SetDOMProps();
  _HookEvents();

  _CheckState  = undefined;
  _HookEvents  = undefined;
  _SetDOMProps = undefined;
}

/* Checks width's in state, intializes hdrHeights */
function _CheckState() {
  var em = px30em / 30.0,
      st,
      writeState = false;

  winFloatingTop  = FLT_TOP  * em;
  oList.hdrHeight = LIST_HDR * em;
   oToc.hdrHeight = TOC_HDR  * em;

  // seemed to be a good width...
  em = (0.6667 * px50Char).toFixed(0);

  // set up state with DOM measurement
  for (var i = 0; i < 3; i++) {
    st = state.display[i];
    if (st.list.width === 0) {
      st.list.width = em;
      writeState = true;
    }
    if (st.toc.width === 0) {
      st.toc.width = em;
      writeState = true;
    }
  }
  if (state.display[1].widthDocked === 0) {
    st.widthDocked = em;
    writeState = true;
  }
  if (writeState && storage)
    storage.yardState = JSON.stringify(state);
}

/* Hooks oList & oToc events on first load */
function _HookEvents() {
  var el = _id('list_search_text');
  el.tabIndex = 1;
  el.addEventListener('keypress', listSearchKP , false);
  el.addEventListener('input'   , listSearchChg, false);

  _id('list_header').addEventListener('click', listClkHeader, false);
  _id('toc_header' ).addEventListener('click',  tocClkHeader, false);

  oList.nav.addEventListener('click', paneClk.bind(oList), false);
   oToc.nav.addEventListener('click', paneClk.bind(oToc) , false);

    _id('list_sizer').addEventListener('mousedown',  oList.resizeMD, false);
    _id('toc_sizer' ).addEventListener('mousedown',   oToc.resizeMD, false);

  if (isTouch) {
    _id('list_sizer').addEventListener('touchstart', oList.resizeTS, false);
    _id('toc_sizer' ).addEventListener('touchstart',  oToc.resizeTS, false);
  }
}

/* Loads properties of oList & oToc releated to elements on first load */
function _SetDOMProps() {
  oList.e     = _id('y_list');
  oList.s     = _id('y_list').style;
  oList.bLoc  = _id('list_loc');
  oList.bVis  = _id('list_vis');
  oList.nav   = _id('list_nav');
  oList.items = _id('list_items');

  oToc.e     = _id('y_toc');
  oToc.s     = _id('y_toc').style;
  oToc.bLoc  = _id('toc_loc');
  oToc.bVis  = _id('toc_vis');
  oToc.nav   = _id('toc_nav');
  oToc.items = _id('toc_items');
}

//} @!endgroup

//{ @!group oPane Functions

/* Only called by domLayout, sets panes to state of state[winType]
 * @param winTypeLast [Integer] previous winType (-1 on init)
 */
function pane_LocSet(winTypeLast) {
  cS = state.display[winType];
  oList.d = cS.list;
  oToc.d  = cS.toc;
  paneLocSet(oList, winTypeLast);
  paneLocSet(oToc , winTypeLast);
}

/* Called when a button in the main header is clicked
 * @param id [String] id of the clicked button
 */
function pane_MainClk(id) {
  switch (id) {
  case 'list_loc':
    if (oList.bLoc.disabled) return;
    oList.d.docked = !oList.d.docked;
    paneShow(oList);
    break;
  case 'toc_loc':
    if (oToc.bLoc.disabled) return;
    oToc.d.docked = !oToc.d.docked;
    paneShow(oToc);
    break;
  case 'list_vis':
    if (oList.d.vis) paneHide(oList);
    else             paneShow(oList);
    break;
  case 'toc_vis':
    if (oToc.d.vis) paneHide(oToc);
    else            paneShow(oToc);
    break;
  }
}

/* Called when a key is pressed, from winKeyDown
 * @param key [String] key pressed
 */
function pane_MainKD(key) {
  if (WIN_PANE_KD.indexOf(key) < 0) return;
  switch (key) {
  case 'c':
    listGoto('class');
    break;
  case 'd':
    listGoto('doc');
    break;
  case 'l':
    if (oList.d.vis) paneHide(oList);
    else             paneShow(oList);
    break;
  case 'm':
    listGoto('method');
    break;
  case 'p':
    listGoto('properties');
    break;
  case 's':
    if (!oList.d.vis) paneShow(oList);
    _id('list_search_text').focus();
    break;
  case 't':
    if (oToc.d.vis) paneHide(oToc);
    else            paneShow(oToc);
    break;
  }
}

/* @!visibility private */

/* Event handler for pane list click, bound to oList or oToc in paneHookEvents */
function paneClk(e) {
  var tgt = e.target,
      eA,
      eLI,
      isList = (this === oList),
      cancel = false,
      t;

  if (tgt.tagName === 'NAV' &&
    tgt.classList.contains('y_nav')) return;

  eLI = getPrntByIO(tgt, HTMLLIElement);

  if (tgt instanceof HTMLButtonElement) {
    eLI.classList.toggle(CN_CLOSED);
    if (isList) listEvenOdd();
    cancel = true;
  } else if ( eLI && ( eA = eLI.querySelector('a') ) && !e.ctrlKey) {
    if (this.clickedLIOld) this.clickedLIOld.classList.remove(CN_CLICKED);
    this.clickedLIOld = this.clickedLI;
    clickedTop = eLI.getBoundingClientRect().top - fwHdrHgt;
    if (!isList) clickedTop -= 1.0;   // bottom-border in TOC
    this.clickedLI = eLI;
    this.clickedA = eA;
    clickedBy = ( isList ? CB_LIST : CB_TOC );
    if (eA.hash !== '')
      gotoDoc(eA.pathname + '#' + decodeURIComponent(eA.hash.replace(/%-/, '%25-')).slice(1));
    else if ( !/\/#$/.test(eA.href) )
      gotoDoc(eA.href);
    cancel = true;
  }
  if (cancel) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  };
}

/* Hides a pane
 * @param me [oList, oToc]
 */
function paneHide(me) {
  me.bVis.className = CN_HIDDEN;
  me.d.vis = false;
  me.e.classList.add(CN_HIDDEN);
  if (me.d.docked) setZoom(eContent.style);
  updateCSS();
  if (storage) storage.yardState = JSON.stringify(state);
}

/* Sets location of panes, only called by pane_LocSet
 * @param me [oList, oToc]
 * @param winTypeLast [Integer] previous winType, -1 on first load
 */
function paneLocSet(me, winTypeLast) {
  var isDocked = me.d.docked,
      prevSt = winTypeLast >= 0 ? state.display[winTypeLast] : null,
      cnLoc = isDocked ? CN_DOCKED : CN_FLOATING,
      meLast = isFirstLoad || (me === oList ? prevSt.list : prevSt.toc),
      dChng  = isFirstLoad || (me.d.docked !== meLast.docked);

  if (dChng) {
    cnLoc = isDocked ? CN_DOCKED : CN_FLOATING;
    me.e.className = cnLoc + (isTouch ? CN_TOUCH : '');
    me.bLoc.className = cnLoc;
  }
  if (me.d.vis) {
    me.e.classList.remove(CN_HIDDEN);
    me.bVis.className = CN_BTN_VIS;
  } else {
    me.e.classList.add(CN_HIDDEN);
    me.bVis.className = CN_HIDDEN;
  }
  if (isDocked) {
    me.s.width = ( winType === 1 ? cS.widthDocked : me.d.width ) + 'px';
  } else {
    me.s.width = '';
  }

}

/* Makes a pane list item visible.  Only called by paneScrollTo.
 * @param prnt [HTMLElement] item to make visible
 * @return [Boolean] true any items were 'opened' to show the item
 */
function paneOpenToItem(prnt) {
  var notFirst = false,
      heightChanged = false,
      open = [];

  do {
    if (prnt.tagName === 'LI') {
      if (notFirst) {
        if ( prnt.classList.contains(CN_CLOSED) ) {
          open.push(prnt);
        }
      } else notFirst = true;
    }
    prnt = prnt.parentElement;
  }
  while (prnt.tagName === 'UL' || prnt.tagName === 'OL' || prnt.tagName === 'LI');

  if (open.length > 0) {
    heightChanged = true;
    for (var i = 0, el; el = open[i]; i++) { el.classList.remove(CN_CLOSED); }
  }
  return heightChanged;
}

/* Called if a Pane global 'minus' (close) or 'plus' (open) button is clicked.
 * @param me [oList, oToc] pane to change
 * @param isOpen [Boolean]
 */
function paneOC(me, isOpen) {
  var isList = (me === oList),
      qsa = isList ? 'li > ul' : 'li > ol',
      nl = me.items.querySelectorAll(qsa);;

  if (isOpen) {
    for (var i = 0, el; el = nl[i]; i++) {
      el.parentElement.classList.remove(CN_CLOSED);
    }
  } else {
    for (var i = 0, el; el = nl[i]; i++) {
      el.parentElement.classList.add(CN_CLOSED);
    }
  }
  if (isList) listEvenOdd();
}

/* Scrolls to a list item and highlights.
 * @param me [oList, oToc] pane to change
 * @param eA [HTMLAnchorElement]
 */
function paneScrollTo(me, eA) {
  var eSTop,
      offset,
      eLI,
      clkTop;

  if (eA) {
    if (eLI = getPrntByIO(eA, HTMLLIElement) ) {
      if (eLI !== me.clickedLI && (me.clickedLI instanceof HTMLLIElement) )
        me.clickedLI.classList.remove(CN_CLICKED);

      me.clickedLI = eLI;
      me.clickedA  = eA;
      if (me.isOpenClose) {
        if (paneOpenToItem(eLI) && me === oList) listEvenOdd();
      }
      eLI.classList.add(CN_CLICKED);
      offset = me.d.docked ? me.hdrHeight : winFloatingTop;
      if (clickedBy === CB_OBJ_PATH)
        clkTop = me.hdrHeight + 3 * H_CLS * px30em / 30.0;
      else
        clkTop = Math.max(me.hdrHeight, clickedTop) +  - fwHdrHgt;
      eSTop = eLI.offsetTop - clkTop + offset;
      me.nav.scrollTop = eSTop - ( me === oToc ? 1 : 0) - fwHdrHgt;
    }
  } else {
    if (me.clickedLI) me.clickedLI.classList.remove(CN_CLICKED);
    me.clickedA  = null;
    me.clickedLI = null;
  }
}

/* Shows a pane
 * @param me [oList, oToc]
 */
function paneShow(me) {
  var isList = (me === oList),
      you = isList ? oToc : oList,
      curDocked = me.e.classList.contains(CN_DOCKED),
      newDocked = me.d.docked,
      isDockedChanged = (curDocked !== newDocked),
      cnLoc = newDocked ? CN_DOCKED : CN_FLOATING;

  if (isDockedChanged) {
    me.bLoc.className = cnLoc;
    me.e.className = cnLoc + (isTouch ? CN_TOUCH : '');
  }
  if (newDocked) {
    me.s.width = ((winType === 1) ? cS.widthDocked : me.d.width) + 'px';
  } else {
    me.s.width = '';
  }


  me.e.classList.remove(CN_HIDDEN);
  me.d.vis = true;
  me.bVis.className = CN_BTN_VIS;

  if ( !newDocked && !you.d.docked ) {
    if (you.d.vis) paneHide(you);
  } else if (winType === 1) {
    if (newDocked && you.d.docked && you.d.vis) paneHide(you);
  }
  if (isList || aDOMCur.hash) me.showClicked(aDOMCur);
  if (storage) storage.yardState = JSON.stringify(state);
  setZoom(eContent.style);
  updateCSS();
}

/* @!visibility public */

//} @!endgroup

//{ @!group oList Functions

/* Event Handler for Window keyPress
 * @param key [String] string of the key pressed
 */
function list_KeyPress(key) {
  var eA,
      re,
      result;

  // return if class, only list nested list
  if (oList.type === LIST_CLASS) return;

  txt = key.replace(/([\?*+^|\.\$\[\]\(\)\{\}])/g, "\\$1");

  if (oList.type === LIST_METHOD) {
    re = new RegExp('^[\.#]?' + txt, 'i');
  } else {
    re = new RegExp('^' + txt, 'i');
  }
  result = oList.searchInfo.find( function (o) { return re.test(o.text); } );

  if (result) {
    eA = result.a
    oList.nav.scrollTop = getPrntByIO(eA, HTMLLIElement).offsetTop;
  }
}

/* xhr callback function when a new List document is ready, called by
 * xhrReadyStateChange
 * @param docFrag [DocumentFragment] body element of url document
 * @param title   [String] \<head\>\<title\> textContent
 * @param url     [String]
 * @param status  [Integer]
 * @param ms      [Float]   time to parse docFrag
 * @param msRcv   {Float]   time from xhrSend to xhrRSC
 */
function list_xhrCB(docFrag, title, url, status, ms, msRcv) {
  var newMenu,
      newUL,
      oldUL = _id('list_items'),
      hdr   = _id('list_header'),
      len,
      t;

  if (status !== 200 || !docFrag) {
    setWait(-1);
    alert('Bad return with status ' + status + " from location\n" + url);
    return;
  }

  oDbgList.xhrRSC = ms;
  var tSt = performance.now(), tEnd;
  oDbgList.xhrRcv = msRcv;

  oLoad.xhr = null;
  oLoad.cancel = oLoad.isRunning;
  oList.clickedA = null;
  oList.clickedLI = null;

  newMenu = docFrag.getElementById('list_menu').cloneNode(true);

  newUL = docFrag.getElementById('list_items');

  listGetInfo(newUL);
  listSearchLoad(newMenu, newUL);
  listEvenOdd(newUL);

  t = oList.isOpenClose;
  hdr.querySelector('button.y_minus').disabled =  !t;
  hdr.querySelector('button.y_plus' ).disabled =  !t;

  if (t = _id('list_search_items') ) oList.nav.removeChild(t);

  _id('list_title').textContent = title;

  len = newUL.childElementCount;
  hdr.replaceChild(newMenu, _id('list_menu') );

  if (dbgListTiming) {
    oDbgList.render = performance.now();
    oDbgList.cbProc = oDbgList.render - tSt;
    tSt = performance.now();
  }

  if (_id('list_search_text').value.trim() !== '') {
    newUL.style.display = 'none';
  }

  if (len > 2000) {
    t = newUL.cloneNode(false);
    oList.nav.replaceChild(t, oldUL);
    oLoad.cancel = false;
    listLoadSplit(newUL, t, 800, listLoadDone, oLoad);
  } else {
    setTimeout(listLoadDone, 0);
    oList.nav.replaceChild(newUL, oldUL);
  }
}

/* To match Ruby CGI.escape /([^ a-zA-Z0-9_.-]+)/
 * @param str [String] unescaped string
 * @return [String] escaped string
 */
function encodeStr(str) {
  return str.replace(/[^ a-zA-Z0-9_.-]/g, encodeChar );
}

/* Return escaped char
 * @param c [Char] single character string
 * @return [String] escaped string, ie '!' => '%21'
 */
function encodeChar(c) {
  return '%' + c.charCodeAt(0).toString(16).toUpperCase();
}

/* Highlights an item in the oList list
 * @param aDOM [HTMLAnchorElement] anchor with object / url info
 */
function list_ShowClicked(aDOM) {
  // aDOM hash is NOT encoded
  var pathName = aDOM.pathname,
      pathFull = pathName,
      hrefA,
      qs,
      eA,
      eLI = oList.clickedLI,
      eNewClickedLI,
      paneUL,
      t;

  if (clickedBy === CB_LIST) {
    if (oList.clickedLIOld) {
      oList.clickedLIOld.classList.remove(CN_CLICKED);
      oList.clickedLIOld = null;
    }
    if (oList.clickedLI) oList.clickedLI.classList.add(CN_CLICKED);
    return;
  }
  if (aDOM.hash)
    pathFull += '#' + encodeStr( aDOM.hash.slice(1) );

  if (oList.clickedA) {
    hrefA = oList.clickedA.getAttribute('href');
    if (hrefA === pathFull) {
      eA = oList.clickedA;
    } else if (hrefA === pathName) {
      eA = oList.clickedA;
      if ( eLI instanceof HTMLLIElement &&
        eLI.classList.contains(CN_CLICKED) ) return;
    }
    if (eA) eNewClickedLI = eLI;
  };

  if (!eA) {
    paneUL = ( t = _id('list_search_items') ) ? t : oList.items;
    qs = 'a[href="' + pathFull + '"]';
    eA = paneUL.querySelector(qs);
    if (!eA) {
      qs = 'a[href="' + pathName + '"]';
      eA = paneUL.querySelector(qs);
    }
  }
  paneScrollTo(oList, eA);
}

/* Event Handler for oList Header click */
function listClkHeader(e) {
  var tgt = e.target,
      tag = tgt.tagName,
      cancel = false;

  switch (tag) {
  case 'BUTTON':
    paneOC(oList, (tgt.className === 'y_plus'));
    cancel = true;
    break;
  case 'A':
    if (!e.ctrlKey) {
      cancel = true;
      setWait(CB_LIST);
      if (oLoad.xhr) {
        oLoad.xhr.abort();
        oLoad.xhr = null;
      }
      if   (oLoad.isRunning)   oLoad.cancel = true;
      listSearchCancel();
      oLoad.xhr = xhrSend(tgt.href.trim(), list_xhrCB);
    }
    break;
  case 'path':
    tag = 'svg';
    tgt = tgt.parentElement;
    /* falls through */
  case 'svg':
    if (tgt.id === 'list_search_icon') {
      list_SearchClear();
      cancel = true;
    }
    break;
  case 'INPUT':
    if (tgt.id === 'list_search_text') {
      tgt.focus();
      cancel = true;
    }
    break;
  }
  if (cancel) {
    e.stopPropagation();
    e.preventDefault();
    return false;
  }
}

/* Sets the even / odd shading of oList items */
function listEvenOdd(items) {
  var liVis = [],
        odd = [],
       even = [],
     lenVis = 0;

//  if (oList.type === LIST_METHOD) return;

  if (items === undefined) items = oList.items;

  // array liVis passed by ref, loaded with visible items
  listGetVis( items.children, liVis );
  lenVis = liVis.length;
  oList.itemsVis = lenVis;

  // find all elements that require changing, push to odd & even arrays
  for (var j = 0, el; j < lenVis; j++) {
    el = liVis[j];
    if (j % 2 === 0) {
      if ( !el.classList.contains('odd') )  odd.push(el);
    } else {
      if ( !el.classList.contains('even')  ) even.push(el);
    }
  }

  // now loop thru items in both arrays and change class
  for (var j = 0, elCL, len =  odd.length; j < len; j++) {
    elCL = odd[j].classList;
    elCL.remove('even') ; elCL.add('odd');
  }
  for (var j = 0, elCL, len = even.length; j < len; j++) {
    elCL = even[j].classList;
    elCL.remove('odd')  ; elCL.add('even');
  }
}

/* Called after a new url is loaded into oList
 *
 * Sets the following:
 * * type
 * * isOpenClose
 * * itemVis
 * @param ul [HTMLULElement] top UL element
 */
function listGetInfo(ul) {
  var ulCL = ul.classList;

  oList.type = LIST_UNKNOWN;
  for (var i = 0, t; t = LIST_ENUM[i]; i++) {
    if ( ulCL.contains(t) ) {
      oList.type = i;
      break;
    }
  }
  if ( oList.isOpenClose = (ul.querySelector('button') !== null) ) {
    var aLI = [];
    listGetVis( ul.children, aLI );
    oList.itemsVis = aLI.length;
  } else oList.itemsVis = oList.items;
  if (dbgListTiming) oDbgList.elements = ul.querySelectorAll('*').length;
}

/* Gets an ordered list of visible items (LI elements), only used when
 * isOpenClose is true.  Reentrant.
 * @param nl    [HTMLCollection] list of nodes to check
 * @param liVis [<HTMLLIElement>] array of LI elements that are visible
 */
function listGetVis(nl, liVis) {
  for (var i = 0, el, ul; el = nl[i]; i++) {
    liVis.push(el);
    ul = el.lastElementChild;
    if (ul.tagName === 'UL' && !el.classList.contains(CN_CLOSED)) {
      listGetVis( ul.children, liVis );
    }
  }
}

/* Called when Ctrl-Alt combinations are used to goto a list
 * @param list [String]
 */
function listGoto(list) {
  var nl = _id('list_menu').querySelectorAll('a'),
      re = new RegExp('^\\s*' + list, 'i');

  for (var i = 0, el; el = nl[i]; i++) {
    if (re.test(el.textContent)) {
      setWait(CB_LIST);
      if (oLoad.xhr) {
        oLoad.xhr.abort();
        oLoad.xhr = null;
      }
      if   (oLoad.isRunning)   oLoad.cancel = true;
      listSearchCancel();
      oLoad.xhr = xhrSend(el.href, list_xhrCB);
      if (!oList.d.vis) paneShow(oList);
      break;
    }
  }
}

/* Callback function needed for when {listLoadSplit} completes. */
function listLoadDone() {
  var eSearch = _id('list_search_text'),
      t;

  oList.items = _id('list_items');
  oList.itemsSearch = 0;
  setWait(-1);

  if (isFirstLoad) {
    oList.s.visibility = '';
    clickedBy = CB_POP_STATE;
    clickedTop = (oToc.hdrHeight + 3.0 * H_CLS * px30em / 30) - fwHdrHgt;
    if (aDOMNext.hash) {
      gotoHash();
    } else if (oList.d.vis)
      oList.showClicked(aDOMNext);
    isFirstLoad = false;
  } else if (oList.d.vis) list_ShowClicked(aDOMNext);

  oLoad.isRunning = false;
  if (dbgListTiming) {
    oDbgList.render = performance.now() - oDbgList.render;
    dbgListLoad();
  }

  if ( t = eSearch.value.trim()) {
    if (t !== '') listSearchChg();
  }
}

/* Splits loading of LI elements when list is large, better UI responsiveness.
 * @param xhrEl  [HTMLElement] element with children to copy from (from xhr docFrag)
 * @param docEl  [HTMLElement] element to add children to (in document)
 * @param qty    [Integer]     number of children to load in each loop
 * @param cbFunc [Function]    callback function called when all children have
 *   been loaded/moved
 * @param oState [object] object to pass run to app, and cancel from app
 */
function listLoadSplit(xhrEl, docEl, qty, cbFunc, oState) {
  var tmrFunc,
      rng = document.createRange(),
      tmrIds = [],
      len;

  var tSt = performance.now(), tEnd;

  oState.isRunning = true;

  tmrFunc = function() {
    return function() {
      if (xhrEl.childElementCount > 0) {
        rng.setStartBefore(xhrEl.firstElementChild);
        rng.setEndAfter(xhrEl.children[qty-1] || xhrEl.lastElementChild);
        docEl.appendChild( rng.extractContents() );
        if (!oState.cancel) {
          if (xhrEl.childElementCount > 0) {
            tmrIds.push(setTimeout(tmrFunc, 30));
          } else {
            oState.isRunning = false;
            if (cbFunc !== undefined) setTimeout(cbFunc, 0);
            return;
          }
        } else {
          //console.log('tmrFunc Cancel');
          len = tmrIds.length;
          if (len > 0) {
            for (var i = 0; i < len; i++) {
              if (tmrIds[i]) clearTimeout(tmrIds[i]);
            }
          }
          setWait(-1);
          oState.isRunning = false;
        }
      }
    };
  }();
  tmrIds.push(setTimeout(tmrFunc, 0));
}

//} @!endgroup

//{ @!group oList Search Functions

/* Event handler for oList search input change */
function listSearchChg(e) {
  var text = e ? e.target.value.trim() : _id('list_search_text').value.trim(),
      t;

  if (text !== '') {
    _id('list_search_icon').classList.add('s_clr');
    if (lastSearchText !== text) {
      listSearchCancel();
    }
    lastSearchText = text;
    listSearchExec(text);
  } else {
    list_SearchClear();
  }
}

/* Event handler for oList search input keypress */
function listSearchKP(e) {
  var key = String.fromCharCode(e.which);
  if ( !RE_LIST_SEARCH.test(key) ) {
    e.stopPropagation();
    return true;
  }
}

function listSearchCancel() {
  for (var i = 0, o; o = oSearches[i]; i++) {
    if (o && o.running) o.cancel = true;
  }
}

/* Clears List search list
 */
function list_SearchClear() {
  var t;
  oList.itemsSearch = 0;
  listSearchCancel();
  _id('list_search_text').value = '';
  _id('list_search_icon').classList.remove('s_clr');
  if (t = _id('list_search_items') ) {
    t.style.display = 'none';
    oList.nav.removeChild(t);
  }
  oList.items.style.display = '';
  oList.clickedA  = null;
  oList.clickedLI = null;
  t = aDOMCur.pathname;
  if (t) list_ShowClicked(aDOMCur);
}

/* Create elements from search result array
 * @param list [<object>]
 * @param re   [RegEx] regex string for highlighting search result text
 */
function listSearchCreate(list, re) {
  var li = document.createElement('li'),
      docFrag = document.createDocumentFragment(),
      a, replRe, replText, inHTML;

  for (var i = 0, sObj, small, newLI; sObj = list[i]; i++) {
    newLI = li.cloneNode(false);

    a = sObj.a.cloneNode(true);
    txt = a.firstChild.textContent;
    txt = txt.replace(/&/g, '&amp;');
    txt = txt.replace(/</g, '&lt;');
    txt = txt.replace(/>/g, '&gt;');

    replText = txt.replace(re, "<em>$1</em>");

    inHTML = a.innerHTML;
    replRe = new RegExp('^' + txt.replace(/([\*\+\|\^\.\[\]+?$])/g, "\\$1"));
    inHTML = inHTML.replace(replRe, replText);
    inHTML = inHTML.replace(replRe, replText);
    a.innerHTML = inHTML;

    newLI.appendChild(a);
    if (sObj.small) {
      small = sObj.small.cloneNode(true);
      small.className = '';
      small.textContent = small.textContent.trim();
      newLI.appendChild( small );
    }
    if (i % 2 === 0) newLI.className = 'odd';
    else             newLI.className = 'even';
    docFrag.appendChild(newLI);
  }
  return docFrag;
}

/* Performs the List search
 * @note If result set is large, calls {listLoadSplit} so UI is responsive
 * while loading search results.  This allows search input text changes to
 * cancel the search result display.
 * @param text [String] text string to search for
 */
function listSearchExec(text) {
  var re,
      results,
      ul = document.createElement('ul'),
      oldUl,
      txt, pre, t,
      isStart;

  var tSt = performance.now(), tS;

  pre = text.charAt(0);
  if (pre === t2Info.CSEP || pre === t2Info.ISEP) {
    text = text.slice(1);
    if (pre === '.') pre = '\\.';
  } else pre = null;

  // isStart = ( /^[^!=?<>+|*\^\]_]/.test(text.charAt(0)) && (
  //    text.charAt(0) === text.charAt(0).toUpperCase() ) );
  isStart = /[A-Z]/.test(text.charAt(0));


  // create RegEx for search, dependent on whether 1st letter is uppercase
  // escapes ? * + ^ | . $ [ ] ( ) { } in search string
  txt = text.replace(/([\?*+^|\.\$\[\]\(\)\{\}])/g, "\\$1");
  if (isStart) {
    if (oList.type === LIST_METHOD) {
      if (pre)
        re = new RegExp('^' + pre + txt, 'i');
      else
        re = new RegExp('(^#' + txt + '|^\\.' + txt + '|^' + txt + ')', 'i');
    } else
      re = new RegExp('^' + txt, 'i');
  } else {
    if (oList.type === LIST_METHOD && pre ) {
      re = new RegExp('^' + pre + '.*?' + txt, 'i');
    } else {
      re = new RegExp(txt, 'i');
    }
  }
  results = oList.searchInfo.filter( function (o) { return re.test(o.text); } );

  oList.itemsSearch = results.length;

  if (oList.itemsSearch > 0) {
    // sort objects via name then namespace
    if (oList.isOpenClose) {
      results = results.sort( function(a, b) {
        var at = a.text.toLowerCase(),
            bt = b.text.toLowerCase(),
            as = a.small ? a.small.textContent : '',
            bs = b.small ? b.small.textContent : '';

        if (at > bt)      return  1;
        else if (at < bt) return -1;
        else if (as > bs) return  1;
        else if (bs > as) return -1;
        else return 0;
      } );
    }

    if (oList.type === LIST_UNKNOWN || oList.type === LIST_FILE)
      ul.className = 'file';
    else
      ul.className = LIST_ENUM[LIST_METHOD];

    // Create RegEx (re) for search string highlight
    txt = txt.replace(/&/g, '&amp;');
    txt = txt.replace(/</g, '&lt;');
    txt = txt.replace(/>/g, '&gt;');
    if (isStart) {
      if (oList.type === LIST_METHOD) {
        if (pre)
          re = new RegExp('^(' + pre + txt + ')', 'i');
        else
          re = new RegExp('^([#\.]?' + txt + ')', 'i');
      } else
        re = new RegExp('^(' + txt + ')', 'i');
    } else {
      re = new RegExp('(' + txt + ')', 'ig');
    }
  }

  if (dbgSearchLoad) {
    tS = fmtTL(performance.now() - tSt, oList.itemsSearch);
    console.log('Search   exec    ' + tS + ' ' + text);
  }

  oList.items.style.display = 'none';
  ul.id = 'list_search_items';
  oldUl = _id('list_search_items');
  // If less than 600 matches, throw them all in, otherwise use splitLoad
  if (oList.itemsSearch < 600) {
    ul.appendChild( listSearchCreate(results, re) );
    if (oldUl)
      oList.nav.replaceChild(ul, oldUl);
    else
      oList.nav.appendChild(ul);
    listSearchExec2();
  } else {
    var   sUL = ul.cloneNode(false),
      oSearch = {
          list: results,
            re: re,
            ul: sUL,
           qty: 200,
          text: text,
       running: true,
        cancel: false,
            cb: listSearchExec2
      }
    oSearches.push(oSearch);
    if (oldUl) oList.nav.replaceChild(sUL, oldUl);
    else       oList.nav.appendChild(sUL);
    listSearchSplit(oSearch);
  }
  t = null;
}

/* Callback function needed for when search display {listLoadSplit} completes. */
function listSearchExec2() {
  var len = oSearches.length - 1,
      o;
  if (oList.itemsSearch > 0) {
    oList.clickedA = null;
    oList.showClicked(aDOMCur);
    if (!oList.clickedLI) oList.nav.scrollTop = 0;
  }
  if (len >= 0) {
    for (var i = len; i >= 0; i--) {
      o = oSearches[i];
      if (o && !o.running) {
        o = null;
        oSearches.pop();
      }
    }
  }
}

/* Splits loading of LI elements when list is large, better UI responsiveness.
 * @note Used for both large (+2,000) lists and large (+500) search result sets.
 * @param xhrEl [HTMLElement] element with children to copy from (from xhr frag)
 * @param docEl [HTMLElement] element to add children to (in document)
 * @param qty [Integer] number of children to load in each loop
 * @param cbFunc [Function] callback function called when all children have
 * been loaded/moved
 * @param oState [object] object to pass run to app, and cancel from app
 */
function listSearchSplit(o) {
  var tmrFunc,
      tmrIds = [],
      list,
      len;

  var tSt = performance.now(), tS;

  tmrFunc = function() {
    return function() {
      if (o.list.length > 0) {
        list = o.list.splice(0, o.qty);
        o.ul.appendChild( listSearchCreate(list, o.re) );
        if (!o.cancel) {
          if (o.list.length > 0) {
            if (dbgSearchSplit) {
              tS = fmtTL(performance.now() - tSt, o.list.length + 0);
              console.log('Search   split   ' + tS + ' ' +
                LIST_ENUM[oList.type]  + '  ' + o.text);
            }
            tmrIds.push(setTimeout(tmrFunc, 30));
          } else {
            o.running = false;
            if (o.cb !== undefined) setTimeout(o.cb, 0);
            return;
          }
        } else {
          len = tmrIds.length;
          if (len > 0) {
            for (var i = 0; i < len; i++) {
              if (tmrIds[i]) clearTimeout(tmrIds[i]);
            }
          }
          setWait(-1);
          o.running = false;
          if (dbgSearchSplit) {
            tS = fmtTL(performance.now() - tSt, o.list.length);
            console.log('Search   split   ' + tS + ' ' +
              LIST_ENUM[oList.type] + ' Cancel');
          }
        }
      }
    };
  }();
  tmrIds.push(setTimeout(tmrFunc, 0));
}

/* Loads oList.searchInfo array, sets all href's to the correct path
 * @param menu [HTMLDivElement] the list menu element
 * @param ul   [HTMLULElement]  the top UL element to parse
 */
function listSearchLoad(menu, ul) {
  var nl = ul.querySelectorAll('a'),
      pre = oList.libRoot;

  var tSt, tEnd;
  tSt = performance.now();

  oList.searchInfo = [];
  // Load searchInfo and set list href's
  if (isServer) {
    for (var i = 0, eA, sObj, _small; eA = nl[i]; i++) {
      _small = eA.nextElementSibling;
      if (_small && _small.tagName === 'SMALL')
        sObj = { a: eA, small: _small, text: eA.childNodes[0].textContent };
      else
        sObj = { a: eA, small: null  , text: eA.childNodes[0].textContent };
      oList.searchInfo.push(sObj);
    }

  } else {
    for (var i = 0, eA, sObj, _small; eA = nl[i]; i++) {
      eA.setAttribute('href', pre + eA.getAttribute('href') );
      _small = eA.nextElementSibling;
      if (_small && _small.tagName === 'SMALL')
        sObj = { a: eA, small: _small, text: eA.childNodes[0].textContent };
      else
        sObj = { a: eA, small: null  , text: eA.childNodes[0].textContent };
      oList.searchInfo.push(sObj);
    }
    // Set list menu href's
    nl = menu.querySelectorAll('a');
    for (var i = 0, eA; eA = nl[i]; i++) {
     eA.setAttribute('href', pre + eA.getAttribute('href') );
    }
  }
  oList.itemQty = oList.searchInfo.length;

  if (dbgSearchLoad) {
    tEnd = performance.now() - tSt;
    console.log('Search   load    ' + fmtTL(tEnd, oList.itemQty) +
            ' ' + LIST_ENUM[oList.type]);
  }
}

//} @!endgroup

//{ @!group oToc Functions

/* Generates a table of contents and returns the new OL element
 * @param content [HTMLElement] the node containg the doc content
 * @param isCode  [Boolean] true is the doc is a 'code' doc
 * @return [HTMLOLElement] an OL element filled with TOC info
 */
function toc_Generate(content, isCode) {
  var cA   = document.createElement('a'),
      cBTN = document.createElement('button'),
      cDIV = document.createElement('div'),
      cLI  = document.createElement('li'),
      cOL  = document.createElement('ol'),
      a, div, li, ol,
      _toc = cOL.cloneNode(false),
      toc = _toc,
      counter = 0,
      tags = ['h2', 'h3', 'h4', 'h5', 'h6'],
      level = 0,
      nl,
      hTags = [],
      proposedId,
      qs,
      lastLvl,
      prntIsH2Details,
      thisLvl,
      nextLvl,
      thisIsA,
      thisIsH2Details,
      nextIsA,
      title,
      tmp,
      itemHref,
      leaveOpenLvl = 2;

  oToc.clickedA = null;
  oToc.clickedLI = null;
  if (content.childNodes === 0) return;

  cDIV.appendChild( cBTN.cloneNode(false) );

  _toc.id = 'toc_items';
  _toc.className = 'class lvl0';

  tmp = content.querySelectorAll('h1').length -
        content.querySelectorAll('h1.title').length -
        content.querySelectorAll('h1.alphaindex').length;

  if (tmp > 1) {
    tags.unshift('h1');
    leaveOpenLvl = 1;
  }

  lastLvl = parseInt(tags[0][1], 10);
  tmp = tags.join(', ') + (isCode ? ', ul.summary.compact a' : '');
  nl = content.querySelectorAll(tmp);
  // load nl into array hTags
  for (var i = 0, el; el = nl[i]; i++) { hTags.push(el); };

  // now, loop array
  for (var i = 0, el; el = hTags[i]; i++) {

    thisIsA = (isCode && el.tagName === 'A');
    thisLvl = thisIsA ? 3 : parseInt(el.tagName[1], 10);

    thisIsH2Details = (isCode && thisLvl === 2 &&
      (el.classList.contains('y_details') || el.textContent.match(/Details$/i)));

    if ( !thisIsH2Details && prntIsH2Details &&
      !el.classList.contains('signature') ) {
        continue;
    }

    // nextLvl info, skip if in Code Details
    if (hTags[i+1] && (!isCode || (thisIsH2Details || !prntIsH2Details) )) {
      tmp = hTags[i+1];
      if (isCode && tmp.tagName === 'A') {
        nextIsA = true;
        nextLvl = 3;
      } else {
        nextLvl = parseInt(tmp.tagName[1], 10);
      }
    } else nextLvl = thisLvl;

    // need something for rendered objects in md files ??

    if (thisIsA) {
      // el is a 'summary.compact a', no children, title already parsed
      a = el.cloneNode(false);
      a.textContent = el.textContent;
      li = cLI.cloneNode(false);
    } else {
      // Get text for toc entry
      if (isCode) {
        title = tocCodeTitle(el, content);
      } else {
        title = el.getAttribute('toc-title') || el.textContent;
      }
      // Set id on h tag if undefined
      if (isCode && thisLvl === 3 && el.parentElement.tagName === 'SECTION') {
        itemHref = el.parentElement.id;
      } else {
        itemHref = el.id;
      }
      if (itemHref.length === 0) {
        proposedId = el.getAttribute('toc-id');
        qs = /^[0-9]/.test(proposedId) ? '#\\' : '#';
        if (proposedId !== null && !content.querySelector(qs + proposedId) ) {
          el.id = proposedId;
        } else {
          proposedId = title.replace(/[^a-z0-9\-]+/ig, '_');
          // selectors can't start with an unescaped number
          if ( /\s*/.test(proposedId) ) proposedId = "_" + counter; counter++;
          qs = /^[0-9]/.test(proposedId) ? '#\\' : '#';
          if ( content.querySelector(qs + proposedId) )
            proposedId += counter; counter++;
          el.id = proposedId;
          itemHref = proposedId;
        }
      }
      // load a with title & href
      a = cA.cloneNode(false);
      a.setAttribute('href','#' + itemHref);
      a.textContent = title;

      // move back up
      if (thisLvl < lastLvl) {
        for (var k = 0, newToc; k < lastLvl - thisLvl; k++) {
          level --;
          if (toc.parentElement && (newToc = toc.parentElement.parentElement) )
            toc = newToc;
          else
            break;
        }
      }
    }
    li = cLI.cloneNode(false);


    if (thisLvl < nextLvl) {
      // Has children, needs buttons, div, ol, etc
      level ++;
//    if (thisLvl > leaveOpenLvl || nextIsA) li.className = CN_CLOSED;
      if (thisLvl > leaveOpenLvl) li.className = CN_CLOSED;

      div = cDIV.cloneNode(true);
      div.appendChild(a);
      li.appendChild(div);

      ol  =  cOL.cloneNode();
      ol.className = 'lvl' + level;
      li.appendChild(ol);

      toc.appendChild(li);
      toc = ol;
    } else {
      li.appendChild(a);
      toc.appendChild(li);
    }
    lastLvl = thisLvl;
    if (isCode)
      prntIsH2Details = prntIsH2Details || thisIsH2Details;
  }
  // Done with toc, check for summary vs detail children, and maybe remove some
  if (isCode) tocRemoveSummaryChildren(_toc);

  oToc.isOpenClose = (_toc.querySelector('button') !== null);
//  oToc.nav.replaceChild(_toc, oToc.items);
//  oToc.items = _id('toc_items');
  return _toc;
}

/* Highlights an item in the TOC pane
 * @param aDOM [HTMLAnchorElement] anchor with object / url info,
 * only the hash is used
 */
function toc_ShowClicked(aDOM) {
  var qs = 'a[href="' + decodeURIComponent(aDOM.hash.replace(/%-/, '%25-')) + '"]',
      eA = oToc.items.querySelector(qs);

  if (clickedBy === CB_TOC) {
    if (oToc.clickedLIOld) {
      oToc.clickedLIOld.classList.remove(CN_CLICKED);
      oToc.clickedLIOld = null;
    }
    if (oToc.clickedLI) oToc.clickedLI.classList.add(CN_CLICKED);
    return;
  }
  paneScrollTo(oToc, eA);
};

/* Event handler for TOC header click */
function tocClkHeader(e) {
  var tgt = e.target;
  if (tgt instanceof HTMLButtonElement) {
    paneOC(oToc, (tgt.className === 'y_plus'));
    e.stopPropagation();
    e.preventDefault();
    return false;
  }
}

/* Used with 'code' documents, generates a table of contents entry from
 * an element
 * @param el [HTMLElement] the element to extract title text from
 * @return [String] TOC entry
 */
function tocCodeTitle(el, content) {
  var title = ( el.getAttribute('toc-title') || el.textContent).trim(),
      thisLvl = parseInt(el.tagName[1], 10),
      rePlus = /^[\+\*\|\^]/,
      re,
      titleMain,
      titleSuf,
      pre = '',
      prnt,
      prntId,
      t;

  if (thisLvl === 2) {
    // removes small text, typically expand / collapse
    if (t = el.querySelector('small')) {
      titleSuf = t.textContent;
      if (titleSuf) {
        title = title.replace(titleSuf, '').trim();
      }
    }
  } else if (thisLvl === 3) {
    if ( el.classList.contains('signature') ) {
      if ( el.classList.contains('aws_waiter') ) {
        title = el.querySelector('strong').textContent.replace(/'/g, '');
      } else {
        // check id of section element
        prnt = el.parentElement;
        if (prnt.tagName === 'SECTION' &&
            prnt.classList.contains('method_details') ) {
          prntId = prnt.id;

          if ( t = el.querySelector('strong') ) {
            if (t.previousSibling && t.previousSibling.nodeType === 3 )
              pre = t.previousSibling.nodeValue.trim();
          }

          if ( RE_METH_CLS.test(prntId) )
            title = pre + prntId.replace(RE_METH_CLS, '');
          else if ( RE_METH_INST.test(prntId) )
            title = pre + prntId.replace(RE_METH_INST, '');

//            title = t2Info.CSEP + prntId.replace(RE_METH_CLS, '');
//            title = t2Info.ISEP + prntId.replace(RE_METH_INST, '');

          if (title) return title.replace(/[\(\s].*$/, '');
        }

        if (t = el.querySelector('small')) {
          title = title.replace(t.textContent, '').trim();
        }
        title = title.replace(/[( ][\s\S]*$/g, '');
        if (t = el.querySelector('strong')) {
          titleMain = t.textContent.replace(/\?/, "\\?");
          if ( rePlus.test(titleMain) )
            re = new RegExp('[#.]?\\' + titleMain);
          else
            re = new RegExp('[#.]?' + titleMain);
          if ( t = title.match(re) ) title = t[0];
        }
      }
    }
  }

  title = title.trim();
  return title;
}

/* Removes children from 'Summary' entries if they are similar to the 'Details'
 * entries
 * @param toc [HTMLOLElement]
 */
function tocRemoveSummaryChildren(toc) {
  var RE_SUMMARY = / Summary$/,
      RE_DETAILS = / Details$/,
      summaries = [],
      details   = [],
      checked,
      nl, i, j, txtS, txtD, el, elS, elD, qtyS, qtyD, a;

  nl = toc.childNodes;
  for (i = 0; el = nl[i]; i++) {
    txtS = el.firstElementChild.textContent;
    // push all entries that end in SUMMARY or DETAILS to arrays
    if (RE_SUMMARY.test(txtS)) summaries.push(el);
    if (RE_DETAILS.test(txtS)) details.push(el);
  }
  // loop thru summaries and look for matching details
  for (i = 0; elS = summaries[i]; i++) {
    checked = false;
    txtS = elS.firstElementChild.textContent.replace(RE_SUMMARY, '');
    for (j = 0; elD = details[j]; j++) {
      txtD = elD.firstElementChild.textContent.replace(RE_DETAILS, '');
      if (txtD === txtS) {
        nl = elS.querySelectorAll('ol > li');
        qtyS = nl.length;
        qtyD = elD.querySelectorAll('ol > li').length;

        if (qtyS + 1 >= qtyD) {
          // console.log('Remove ' + txtS);
          elS.removeChild(elS.querySelector('ol'));
          a = elS.querySelector('a').cloneNode(true);
          elS.removeChild(elS.querySelector('div'));
          elS.className = '';
          elS.appendChild(a);
        }
        // break because a match was found
        break;
        checked = true;
      }
    }
    // Probably a constructor in class methods
    if (!checked && elS.querySelectorAll('ol > li').length === 1) {
      elS.removeChild(elS.querySelector('ol'));
      a = elS.querySelector('a').cloneNode(true);
      elS.removeChild(elS.querySelector('div'));
      elS.className = '';
      elS.appendChild(a);
    }
  }
}

//} @!endgroup

//{ @!group Resizer Event Functions

/* event MouseDown
 */
function resizeMD(e) {
  var stateWid;

  if (e.which !== 1) return;

  if (e.altKey || e.ctrlKey) {
    var elWid = this.e.getBoundingClientRect().width,
        em = px30em/30.0,
        min, max;
    if (this === oList) {
      max = (LIST_MAX * em).toFixed(0); min = (LIST_MIN * em).toFixed(0);
    } else {
      max = ( TOC_MAX * em).toFixed(0); min = ( TOC_MIN * em).toFixed(0);
    }
    if (winType === 1 && this.d.docked)
      stateWid = state.display[1].widthDocked;
    else
      stateWid = this.d.width;

    if (e.altKey) {
      if (elWid == this.d.width) {
        this.s.width = (this.d.docked ? max : min) + 'px';
      } else {
        this.s.width = stateWid + 'px';
      }
    } else if (e.ctrlKey) {
      if (elWid == this.d.width) {
        this.s.width = (this.d.docked ? min : max) + 'px';
      } else {
        this.s.width = stateWid + 'px';
      }
    }
    return;
  }

  resizerStWid = this.e.offsetWidth;
  this.s.width = resizerStWid + 'px';
  resizerStX = e.screenX;
  e.preventDefault();
  e.stopPropagation();
  window.addEventListener('mousemove', this.resizeMM, false);
  window.addEventListener('mouseup'  , this.resizeMU, false);
}

/* MouseMove */
function resizeMM(e) {
    var offset   = e.screenX - resizerStX,
        newWidth = resizerStWid + (this.d.docked ? offset : -offset),
        em = px30em/ 30.0,
        minW = em * (this === oList ? LIST_MIN : TOC_MIN),
        maxW = em * (this === oList ? LIST_MAX : TOC_MAX);

  newWidth = Math.max( Math.min(newWidth, maxW), minW);
  newWidth = newWidth.toFixed(0);
  this.s.width = newWidth + 'px';
  if (winType === 1 && this.d.docked) cS.widthDocked = newWidth;
  else this.d.width = newWidth;
  hdrDbg(newWidth + (this === oList ? '_List' : '_TOC') );
}

/* MouseUp */
function resizeMU(e) {
  window.removeEventListener('mousemove', this.resizeMM);
  window.removeEventListener('mouseup'  , this.resizeMU);
  if (storage) storage.yardState = JSON.stringify(state);
  updateCSS();
}

/* TouchStart */
function resizeTS(e) {
  resizerStWid = this.e.offsetWidth;
  this.s.width = resizerStWid + 'px';
  resizerStX = e.touches[0].screenX;
  e.preventDefault();
  e.stopPropagation();
  window.addEventListener('touchmove', this.resizeTM, false);
  window.addEventListener('touchend' , this.resizeTE, false);
}

/* TouchMove */
function resizeTM(e) { this.resizeMM( e.touches[0] ); }

/* TouchEnd */
function resizeTE(e) {
  window.removeEventListener('touchmove', this.resizeTM);
  window.removeEventListener('touchend' , this.resizeTE);
  this.resizeMU(e);
}

//} @!endgroup

__loadPublicState();
__loadPublicState = undefined;

})();

//{ @!group Debug Functions

/* Debug info about document size, element count, etc
 * @param content [HTMLDIVElement]
 */
function dbgDocInfo(content) {
  var lenTC = content.textContent.length / 1024.0,
      lenInnerHTML = content.innerHTML.length / 1024.0,
      lenChildren = content.querySelectorAll('*').length;

  console.log( aDOMNext.href.match(/[^\/]+$/)[0].replace(/\.html/, '') +
    "\n  textContent   " + fmtL(lenTC) + ' KB' +
    "\n  innerHTML     " + fmtL(lenInnerHTML) + ' KB' +
    "\n  elements      " + fmtL(lenChildren)
  )
}

/* Debug info about doc loading timing
 */
function dbgDocLoad() {
  var ttl = oDbgDoc.xhrRSC + oDbgDoc.cbAdd + oDbgDoc.cbToDOM + oDbgDoc.render,
      xhrRSC  = oDbgDoc.xhrRSC,
      cbAdd   = oDbgDoc.cbAdd,
      cbToDOM = oDbgDoc.cbToDOM,
      render  = oDbgDoc.render,
      xhrRcv  = oDbgDoc.xhrRcv,
      hgt = 'na',
      t;

  if ( t = _id('footer') ) {
    hgt = t.offsetTop + t.offsetHeight;
    hgt = hgt / 1000.0;
  }

  ttl = ('      ' + Math.round(ttl)).slice(-7);

  console.log( aDOMCur.href.match(/[^\/]+$/)[0].replace(/\.html/, '') +
    "\n  DOC      TOTAL " + fmtT( ttl     ) +
    "\n  xhrRSC   parse " + fmtT( xhrRSC  ) +
    "\n  xhrCBDoc add   " + fmtT( cbAdd   ) +
    "\n  xhrCBDoc > DOM " + fmtT( cbToDOM ) +
    "\n  render         " + fmtT( render  ) +
    "\n  xhrRcv         " + fmtT( xhrRcv  ) +
    "\n  hgt pixels/1k "  + fmtL( hgt     )
  );
}

/* Debug info about list loading timing
 */
function dbgListLoad() {
  var ttl      = oDbgList.xhrRSC + oDbgList.cbProc + oDbgList.render;
      xhrRSC   = oDbgList.xhrRSC,
      cbAdd    = oDbgList.cbProc,
      render   = oDbgList.render,
      xhrRcv   = oDbgList.xhrRcv,
      items    = oList.itemQty,
      itemsVis = oList.itemsVis,
      elements = oDbgList.elements,
      hgt = oList.items.getBoundingClientRect().height / 1000.0;

  console.log( (oList.libRoot.replace(/\//g, '') + '               ').slice(0,17) +
    ' ' + _id('list_title').textContent +
    "\n  LIST   TOTAL   " + fmtT( ttl     ) +
    "\n  xhrRSC parse   " + fmtT( xhrRSC  ) +
    "\n  xhrCB  proc    " + fmtT( cbAdd   ) +
    "\n  render         " + fmtT( render  ) +
    "\n  xhrRcv         " + fmtT( xhrRcv  ) +
    "\n  hgt pixels/1k "  + fmtL( hgt     ) +
    "\n     ItemsVis   "  + fmtL( itemsVis) +
    "\n     Items      "  + fmtL( items   ) +
    "\n     Elements   "  + fmtL( elements)
  );
}

/* Formats a time for console
 * @param t [Number]
 * @return  [String]
 */
function fmtT(t) {
  return ( '        ' + Math.round(t).toLocaleString() ).slice(-6) + ' ms';
}

/* Formats an integer for console
 * @param l [Number]
 * @return  [String]
 */
 function fmtL(l) {
  return ('       ' + Math.round(l).toLocaleString()).slice(-7);
}

function fmtTL(t, l) {
  return fmtT(t) + ' ' + fmtL(l);
}

//} @!endgroup

//{ @!group Navigation & XHR Functions

/* Called when new documents finish rendering
 */
function finishDocLoad() {
  setWait(-1);
  if (oXHRDoc instanceof XMLHttpRequest) oXHRDoc = null;
  docReady();
  eContent.tabIndex = 1;
  eContent.focus();
  clickedBy  = -1;
  if (dbgDocTiming) {
    console.timeStamp('xhrCBDoc Render Done');
    oDbgDoc.render = performance.now() - oDbgDoc.render;
    dbgDocLoad();
  }
}

/* Called anytime an anchor element is clicked, determines whether to call
 *  xhrSend or gotoHash
 * @param url [String]
 */
function gotoDoc(url) {
  if (!isServer && url.slice(0,6) === '/file.') {
    aDOMNext.href = oList.libRoot +  url.replace(/%-/, '%25-').slice(1);
  } else {
    aDOMNext.href = url.replace(/%-/, '%25-');
  }

  if (aDOMCur.origin !== aDOMNext.origin) {
    window.location = url;
    return false;
  }

  if (aDOMCur.pathname === aDOMNext.pathname && aDOMNext.hash) {
    gotoHash();
  } else {
    if (dbgDocTiming) console.timeStamp('xhrSend');
    if (oXHRDoc instanceof XMLHttpRequest) oXHRDoc.abort();
    setWait(CB_CONTENT);
    oXHRDoc = xhrSend(aDOMNext.href, xhrCBDoc);
  }
  return true;
}

/* Called when hash navigation is required, uses aDOMNext for info.  Always
 *  called by TOC list 'clicks', as TOC links are always for the document
 */
function gotoHash() {
  var hash = decodeURIComponent(aDOMNext.hash.replace(/%-/, '%25-')  ),
      title = winTitle + hash,
      el = _id(hash.slice(1)),
      prnt,
      elOffTop;

  if (!el) return;

  if (el.tagName === 'SECTION' && el.firstElementChild.tagName === 'H3')
    el = el.firstElementChild;

  if (eContentClicked) eContentClicked.classList.remove(CN_CLICKED);

  if (el.tagName === 'DT') {
    prnt = el.parentElement;
    if (prnt.classList.contains('constants') && prnt.classList.contains(CN_HIDDEN))
      prnt.classList.remove(CN_HIDDEN);
      prnt.previousElementSibling.classList.add(CN_HIDDEN);
  }

  if (el) {
    eContentClicked = el;
    el.classList.add(CN_CLICKED);
    if (oList.d.vis) oList.showClicked(aDOMNext);
    if ( oToc.d.vis)  oToc.showClicked(aDOMNext);
  } else {
    el = eContent.querySelector('a[name="' + hash.slice(1) +'"]');
  }

  if (el) {
    elOffTop = getOffsetTop(el);
    if (elOffTop === 0) {
      // constants have ids and maybe hidden by collapsed section
      if (el.parentElement.style.display === 'none') {
        el.parentElement.style.display = '';
        elOffTop = getOffsetTop(el);
      } else if (el.parentElement.parentElement.style.display === 'none') {
        el.parentElement.parentElement.style.display = '';
        elOffTop = getOffsetTop(el);
      }
    }
    if (clickedTop) {
      eContent.scrollTop = elOffTop - clickedTop;
    } else {
      el.scrollIntoView(true);
    }
//    eContent.focus();
    el.focus();
  }

  if (aDOMCur.href === aDOMNext.href) return;

  aDOMCur.href = aDOMNext.href;
  hash = aDOMCur.pathname + hash;
  if (isWinHistory && (clickedBy !== CB_POP_STATE) ) {

    window.history.pushState({name: title, url: hash},
        title, hash.replace(/%-/, '%25-') );
  }
}

/* xhr callback function when a new main document is ready, called by
 * xhrReadyStateChange
 * @param docFrag [DocumentFragment] body element of url document
 * @param title   [String] \<head\>\<title\> textContent
 * @param url     [String]
 * @param status  [Integer]
 * @param ms      [Float]   time to parse docFrag
 * @param msRcv   {Float]   time from xhrSend to xhrRSC
 */
function xhrCBDoc(docFrag, title, url, status, ms, msRcv) {

  if (status !== 200 || docFrag === null) {
    setWait(-1);
    alert('Bad return with status ' + status + " from location\n" + url);
    if (clickedBy === CB_LIST) {
      oList.clickedLI = oList.clickedLIOld;
      oList.clickedA = null;
    }
    return;
  }

  var hash = decodeURIComponent(aDOMNext.hash).slice(1),
      oldMenu = document.getElementById('y_menu'),
      oldContent = eContent,
      oldLibRoot,
      newContentClicked,
      newToc,
      newContent,
      newMenu,
      loadMenu = false,
      eAList,
      aDOMTemp = document.createElement('a'),
      tEl,
      t, t1, nl, tSt, tEnd;

  if (dbgDocTiming) {
    console.timeStamp('xhrCBDoc Start');
    oDbgDoc.xhrRSC = ms;
    tSt = performance.now();
    oDbgDoc.xhrRcv = msRcv;
  }

  // get content and objectPath from docFrag, along with list url
  if ( t = docFrag.getElementById('content') ) {
    if (hash) {
      newContentClicked = docFrag.getElementById(hash);
    }
    t1 = t.parentElement;
    newContent = t1.removeChild(t);
  }

  // Can't load without both
  if (newContent === undefined || oldContent === undefined) return;

  if ( t = docFrag.getElementById('y_header') ) {
    if (t1 = docFrag.getElementById('y_menu') )
      newMenu = t.removeChild(t1);
    if (t1 = docFrag.getElementById('list_href') )
      eAList  = t.removeChild(t1);
  };

  docFrag = null;

  if (newMenu) {
    isServer = (newMenu.className === 'server');
    if (oldMenu) {
      oldMenu.removeEventListener('click', clkMenu);
      loadMenu = true;
    }
  }

  // Update history so eAList is correct path
  if (aDOMNext.href !== aDOMCur.href) {
    t = aDOMNext.pathname + (hash ? "#" + hash : '');
    if (isWinHistory && (clickedBy !== CB_POP_STATE) ) {
      window.history.pushState({name: title, url: t}, title, t);
    }
    aDOMCur.href = aDOMNext.href;
  }

  // Check to see if 'list' path has changed
  if (eAList) {
    oldLibRoot = oList.libRoot;

    if (isServer) {
//      oList.libRoot = t;
    } else {
      oList.libRoot = eAList.pathname.replace(/[^\/]+$/, '');
    }
    if (oldLibRoot !== oList.libRoot) {
      oList.clickedA = null;
      oList.clickedLI = null;
      xhrSend(eAList.href, oList.xhrCB);
    }
  }

  if (dbgDoc) dbgDocInfo(newContent);

  var eTitle  = document.documentElement.querySelector('head title'),
      eMain   = _id('y_main'),
      eHeader = _id('y_header');

  isZoomed = false;
  setZoom(newContent.style);

  winTitle = title;

  oldContent.removeEventListener('click', clkContent);
  eContentClicked = null;
  newToc = addContent(newContent);

  if (!newContentClicked) {
    newContentClicked = newContent.querySelector('a[name="' + hash.slice(1) +'"]');
  } else if (newContentClicked.tagName === 'SECTION' && newContentClicked.firstElementChild.tagName === 'H3') {
    newContentClicked = newContentClicked.firstElementChild;
  }

  if (newContentClicked) {
    newContentClicked.classList.add(CN_CLICKED);
    eContentClicked = newContentClicked;
  }

  // below wraps tables in div element with overflow-x: auto
  t = Array.prototype.slice.call( newContent.querySelectorAll('table') );
  if (t.length > 0) {
    tEl = document.createElement('div');
    tEl.className = 'y_table';
    for (var i = 0, div, prnt, repl, tbl; tbl = t[i]; i++) {
      if (tbl.className === '') {
        div = tEl.cloneNode(false);
        prnt = tbl.parentElement;
        repl = prnt.replaceChild(div, tbl);
        div.appendChild(repl);
      }
    }
  }

  if (dbgDocTiming) {
    console.timeStamp('xhrCBDoc Add Done');
    oDbgDoc.cbAdd = performance.now() - tSt;
    tSt = performance.now();
  }

  setTimeout( finishDocLoad, 0);

  // all the replacements at once
  eMain.replaceChild(newContent, oldContent);
  oToc.nav.replaceChild(newToc, oToc.items);

  if (loadMenu) eHeader.replaceChild(newMenu, oldMenu);
  eTitle.textContent = title;

  // Scroll oList & oToc
  if (oList.d.vis) oList.showClicked(aDOMNext);
  oToc.items = _id('toc_items');
  if ( oToc.d.vis) {
    if (hash) oToc.showClicked(aDOMNext);
    else oToc.nav.scrollTop = 0;
  }

  newContent = null;
  newToc = null;
  newMenu = null;

  eContent = _id('content');

  if (eContentClicked) {
    if (clickedTop) {
      eContent.scrollTop = eContentClicked.offsetTop - clickedTop;
    } else {
      eContentClicked.scrollIntoView(true);
    }
  }

  if (dbgDocTiming) {
    console.timeStamp('xhrCBDoc ToDom Done');
    oDbgDoc.render  = performance.now();
    oDbgDoc.cbToDOM = oDbgDoc.render - tSt;
  }
}

/* xhr onerror function
 * @param _url  [String]
 * @param _func [Function] The function to call when done processing
 * @param status [Integer]
 */
function xhrOnError(url, func, xhr) {
  var status = xhr.status;
  xhr.onreadystatechange = null;
  xhr.onerror = null;
  setWait(-1);
  func(null, null, url, status);
  return false;
}

/* Receives xhr.responseText, parses, loads into a DocumentFragment, which is
 *  returned to func callback.
 *
 * * Parses title element string
 * * Parses to just children of the body element
 * * Removes any script elements
 * @param url  [String]
 * @param func [Function] callback
 * @param xhr  [XMLHttpRequest]
 * @param pn   [Float] performance.now
 */
 function xhrReadyStateChange(url, func, xhr, pn) {
//  console.log('readyState ' + xhr.readyState + '  status ' + xhr.status);
  if (xhr.readyState === 4) {
    if (xhr.status === 200) {
      var title,
          docFrag = document.createDocumentFragment(),
          topDiv = document.createElement('div'),
          doc = xhr.responseText,
          tRcv, tSt, tParse;


      if (dbgDocTiming || dbgListTiming) {
        console.timeStamp('xhrRSC Start');
        tSt = performance.now();
        tRcv = tSt - pn;
      }
      if (doc === '') {
        func(null, null, url, 404, 0, tRcv);
        return;
      }

      title = /<title>([\s\S]+?)<\/title>/.exec(doc);
      if (title) {
        title = title[1];
        title = title.replace(/[\v\n\r]+/g, ' ');
        title = title.replace(/&mdash;/, '-').trim();
        topDiv.innerHTML = title;
        title = topDiv.textContent;
      } else title = '';

      doc = doc.replace(/^[\s\S]+?<body>/, '');
      doc = doc.replace(/<\/body>[\s\S]+$/, '');
      doc = doc.replace(/<script[\s\S]+?<\/script>/gi, '');

      topDiv.innerHTML = doc;
      docFrag.appendChild(topDiv);
      xhr.onreadystatechange = null;
      xhr.onerror = null;

      if (dbgDocTiming || dbgListTiming)
        tParse = performance.now() - tSt;

      func(docFrag, title, url, 200, tParse, tRcv);
      docFrag = null;
      xhr.onreadystatechange = null;
      xhr.onerror = null;
      xhr = null;
    } else if (xhr.status === 404) {
      // below is for RDoc links
      if (/classes\//.test(url) ) {
        url = url.replace(/classes\//, '');
        aDOMNext.href = aDOMNext.href.replace(/classes\//, '');
        xhr.open("GET", url , true);
        xhr.responseType = 'text';
        xhr.setRequestHeader('Content-Type', 'text/html');
        xhr.send();
        return false;
      }
      xhr.onreadystatechange = null;
      xhr.onerror = null;
      func(null, null, url, 404, tParse, tRcv);
    }
  }
}

/* Preps, opens, and sends the xhr request
 * @param url  [String]
 * @param func [Function] The function to call when done processing
 * @return [XMLHttpRequest] xhr object, used for abort
 */
function xhrSend(url, func) {
  var aDOM = document.createElement('a'),
      xhr = new XMLHttpRequest(),
      tSt;

  aDOM.setAttribute('href', url);

  if (aDOM.origin !== window.location.origin) {
    func(null, url);
    return;
  };
  tSt = performance.now();
  xhr.onreadystatechange = xhrReadyStateChange.bind({}, url, func, xhr, tSt);
  xhr.onerror = xhrOnError.bind({}, url, func, xhr);

  xhr.open("GET", url , true);
  xhr.responseType = 'text';
  xhr.setRequestHeader('Content-Type', 'text/html');
  xhr.send();
  return xhr;
}

//} @!endgroup

//{ @!group Misc & Helper Functions

/* Convenience method for document.getElementById()
 *  @param id  [String]
 *  @return    [HTMLElement]
 */
function _id(id) { return document.getElementById(id); }

/* Finds the first parent element whose class matches using instanceof.
 * @param el [HTMLElement]
 * @param io [Class] instanceof comparision class
 * @return [HTMLElement] the parent element
 */
function getPrntByIO(el, io) {
  if (el instanceof io) return el;
  var prnt = el.parentElement;
  while ( prnt && !(prnt instanceof io)) { prnt = prnt.parentElement; }
  return prnt;
}

/* returns offsetTop of element
 * @param el [HTMLElement]
 * @return [Integer] total offsetTop
 */
function getOffsetTop(el) {
  var y = el.offsetTop;
  while (el = el.offsetParent) { y += el.offsetTop; }
  return y;
}

/* Shows 'wait' svg
 * @param type [Integer] CB_CONTENT or CB_LIST
 */
function setWait(type) {
  var oBCR,
      oBCRW,
      itemsX,
      eSVG = _id('y_wait'),
      cls = isTouch ? 'text' : 'run',
      halfWid = 0.5 * waitWidth,
      t;

  if (type === CB_CONTENT) {
    oBCR = eContent.getBoundingClientRect();
    eSVG.style.top  = Math.round(oBCR.top  + 3.0 * halfWid) + 'px';
    eSVG.style.left = Math.round(oBCR.left - halfWid + oBCR.width/2.0) + 'px';
    eSVG.setAttribute('class', cls);
  } else if (type === CB_LIST) {
    // oList.items maybe hidden due to search
    if (t = _id('list_search_items') ) {
      oBCRW = t.getBoundingClientRect();
      itemsX = oBCRW.left + oBCRW.width/2.0;
    }
    if ( !(itemsX > 15 )) {
      if (oList.items) {
        oBCRW = oList.items.getBoundingClientRect();
        itemsX = oBCRW.left + oBCRW.width/2.0;
      }
    }
    if ( !(itemsX > 15 )) {
      oBCR = oList.nav.getBoundingClientRect();
      itemsX = oBCR.left + oBCR.width/2.0;
    }
    oBCR = _id('list_header').getBoundingClientRect();
    eSVG.style.top  = Math.round(oBCR.top + oBCR.height + halfWid) + 'px';
    eSVG.style.left = Math.round(itemsX   - halfWid) + 'px';
    eSVG.setAttribute('class', cls);
  } else
    eSVG.setAttribute('class', '');
}

/* Globally shows / hides source code
 * @param content  [HTMLElement] the content element
 * @param showCode [Boolean]     true to show source
 */
function sourceShowHide(content, showCode) {
  var src =  content.querySelectorAll('section.method_details div.source_code'),
      sToggle = content.querySelectorAll('span.showSource a.toggleSource'),
      len,
      tc,
      top = 0.0,
      eShow,
      hdrBottom = _id('y_header').getBoundingClientRect();

  hdrBottom = hdrBottom.top + hdrBottom.height;

  if (eContentClicked) {
    top = Math.round(eContentClicked.getBoundingClientRect().top);
  }
  if (hdrBottom < top && top < winHeight) {
    eShow = eContentClicked;
  } else {
    var nl = eContent.querySelectorAll('h2, h3');
    // eContentClicked not visible
    for (var i = 0, el, topTest; el = nl[i]; i++) {
      topTest = el.getBoundingClientRect().top;
      if (hdrBottom < topTest && topTest < winHeight) {
        top = Math.round(topTest);
        eShow = el;
        break;
      }
    }
  }

  len = src.length - 1;

  if (showCode) {
    tc = T_HIDE_SRC;
    _id('src').className = 'o';
    for (var i = len; i >= 0; i--) {
      src[i].classList.remove(CN_HIDDEN);
      sToggle[i].textContent = tc;
    }
  } else {
    tc = T_VIEW_SRC;
    _id('src').className = 'c';
    for (var i = len; i >= 0; i--) {
      src[i].classList.add(CN_HIDDEN);
      sToggle[i].textContent = tc;
    }
  }

  if (top !== 0.0) {
    top = eContent.scrollTop + Math.round(eShow.getBoundingClientRect().top) - top;
    eContent.scrollTop = top;
  }
}

/* Called when Summary 'expand / collapse' elements are clicked
 * @param tgt [HTMLAnchorElement]
 */
function summaryToggle(tgt) {
  var nlToggles = eContent.querySelectorAll('a.summary_toggle'),
      nlFull    = eContent.querySelectorAll('ul.summary.full,    dl.summary.full'),
      nlCompact = eContent.querySelectorAll('ul.summary.compact, dl.summary.compact'),
      eH2 = tgt.parentElement.parentElement,
      rTop = eH2.offsetTop - eContent.scrollTop,
      text = (tgt.textContent === 'collapse') ? 'expand' : 'collapse',
      a, grandParent;

  nlToggles = Array.prototype.slice.call(nlToggles);

  if (nlToggles.length > 0) {
    // code below for ruby constants & js constants & variables, assumes they're
    // singular and at the top of the nodelist
    grandParent = nlToggles[0].parentElement.parentElement;
    if (grandParent.id === 'js_h2_cv') {
      a = nlToggles.shift();
      a.textContent = text;
      grandParent.nextElementSibling.style.display = (text === 'collapse') ? '' : 'none';
    }
  }

  len = nlToggles.length - 1;
  if (text === 'expand') {
    for (var i = len; i >= 0; i--) {
      nlToggles[i].textContent = text;
      nlCompact[i].classList.remove(CN_HIDDEN);
         nlFull[i].classList.add(CN_HIDDEN);
    }
  } else {
    for (var i = len; i >= 0; i--) {
      nlToggles[i].textContent = text;
      nlCompact[i].classList.add(CN_HIDDEN);
         nlFull[i].classList.remove(CN_HIDDEN);
    }
  }
  eContent.scrollTop = eH2.offsetTop - rTop;
  state.summaryCollapsed = text;
  if (storage) storage.yardState = JSON.stringify(state);
}

//} @!endgroup

//{ @!group Add Doc Content Functions

/* Main function that calls the remainder of the 'add' functions
 * @param content [HTMLDIVElement] the content div element
 */
function addContent(content) {
  var cls = content.className,
      toc;
      
  if (ga instanceof Function) ga('send', 'pageview', aDOMNext.pathname);

  // for javascript files
  if ( typeof hljs !== 'undefined' &&
      hljs.highlightBlock instanceof Function ) {
//    var nl = content.querySelectorAll('pre.code.javascript, pre.code.cpp');
    var nl = content.querySelectorAll('pre.code');
    for (var i = 0, el; el = nl[i]; i++) {
      if ( !(el.classList.contains('ruby') || el.classList.contains('example') )  )
        hljs.highlightBlock(el);
    }
  }

  if (cls === 'module' || cls === 'class' || cls === 'method') {
    removeEmptyDocString(content);
    addWhiteSpace(content);
    addShowSource(content);
    addDefines(content);
    addSummaryToggle(content);
    toc = oToc.generate(content, true);
    if (isServer && cls !== 'method') addPermaLinks(content);
  } else {
    _id('src').disabled = true;   // Source open/close button
    toc = oToc.generate(content, false);
  }
  return toc;
}

/* Adds 'more... / (less)' element to the 'Defined in:' listing at the
 * top of the page.
 * @param content [HTMLDIVElement] the content div element
 */
function addDefines(content) {
  var nl = content.querySelectorAll('.defines'),
      a = document.createElement('a');

  a.href = '#';
  a.className = 'toggleDefines';
  a.textContent = 'more...';
  for (var i = 0, el, prnt; el = nl[i]; i++) {
    if (prnt = el.parentElement) {
      prnt.appendChild( a.cloneNode(true) );
    }
  }
}

/* If running server, adds the 'permalink' to method signatures in
 *  detail sections
 * @param content [HTMLDIVElement] the content div element
 */
function addPermaLinks(content) {
  var nl = content.querySelectorAll('section h3.signature'),
      a = document.createElement('a'),
      docPath = aDOMNext.pathname;

  a.className   = 'permalink';
  a.textContent = 'permalink';

  for (var i = 0, el, aa, href; el = nl[i]; i++) {
    aa = a.cloneNode(true);
    href = el.parentElement.id;
    if ( /-class_method$/.test(href) )
      href = '.' + href.replace(/-class_method$/, '');
    else
      href = ':' + href.replace(/-[a-z_]+$/, '');
    href = href.replace(/\?$/, '%3F');
    aa.setAttribute('href', docPath + href);
//      el.appendChild(aa);
    el.insertBefore(aa, el.firstChild);
  }
}

/* Adds the 'view / hide source' elements for source code
 * @param content [HTMLDIVElement] the content div element
 */
function addShowSource(content) {
  var nl = content.querySelectorAll('section.method_details div.source_code'),
      span = document.createElement('span'),
      spc = String.fromCharCode(8202),
      showSource = state.showSource;

  span.className = 'showSource';
  span.innerHTML = "[" + spc + "<a href='#' class='toggleSource'>" +
    (showSource ? T_HIDE_SRC : T_VIEW_SRC) + "</a>" + spc + "]";

  _id('src').disabled = (nl.length === 0);

  for (var i = 0, el; el = nl[i]; i++) {
    if (showSource) el.classList.remove(CN_HIDDEN);
    else            el.classList.add(CN_HIDDEN);
    if (el.previousElementSibling.className === 'link_repo')
      el = el.previousElementSibling;
    el.parentElement.insertBefore( span.cloneNode(true) , el);
  }
}

/* Add the 'collapse / expand' elements to the summaries
 * @param content [HTMLDIVElement] the content div element
 */
function addSummaryToggle(content) {
  var nl = content.querySelectorAll('ul.summary'),
      ulFull,
      ulCompact,
      dlFull,
      dlCompact,
      remove,
      nlChildren,
      prnt,
      grandParent,
      fullVis = (state.summaryCollapsed === 'collapse'),
      cnFull    = fullVis ? 'summary full' : 'summary full ' + CN_HIDDEN,
      cnCompact = fullVis ? 'summary compact ' + CN_HIDDEN : 'summary compact' ,
      tEl,
      eA  = document.createElement('a'),
      eUL = document.createElement('ul'),
      eLI = document.createElement('li'),
      eDT = document.createElement('dt'),
      t;

  // Loop thru all the 'summary full' ul elements, clone for compact summaries,
  // then remove content
  for (var i = 0; ulFull = nl[i]; i++) {
    ulCompact = eUL.cloneNode(false);

    // get anchor elements, clean up, append to ulCompact
    nlChildren = ulFull.querySelectorAll('span.summary_signature a');
    for (var j = 0, a, li; a = nlChildren[j]; j++) {
      a = a.cloneNode(true);
      // remove text in anchor but only after strong
      for (var k = 0, child, del = false; child = a.childNodes[k]; k++) {
        if (del) {
          a.removeChild(child);
          k--;
        } else {
          del = (child.nodeType === 1 && child.tagName === 'STRONG');
        }
      }
      // remove anything after anchor
      while (t = a.nextSibling) {
        a.parentElement.removeChild(t);
      }
      li = eLI.cloneNode(false);
      li.appendChild(a);
      ulCompact.appendChild(li);
    }
    ulCompact.className = cnCompact;
    ulFull.className = cnFull;
    ulFull.parentElement.insertBefore(ulCompact, ulFull);
  }

  // now create constants compact list
  dlFull = content.querySelector('dl.constants.summary')
  if (dlFull) {
    dlCompact = document.createElement('dl');

    nl = dlFull.querySelectorAll('dt');
    for (var i = 0, el, tA, tDT; el = nl[i]; i++) {
      tA = eA.cloneNode(false);
      tA.href = "#" + el.id;
      tA.textContent = el.textContent;
      tDT = eDT.cloneNode(false);
      tDT.appendChild(tA);
      dlCompact.appendChild(tDT);
    }
    prnt = dlFull.parentElement;
    dlFull.className = "constants " + cnFull;
    dlCompact.className = "constants " + cnCompact;
    prnt.insertBefore(dlCompact, dlFull);
  }

  nl = content.querySelectorAll('a.summary_toggle');
  nl = Array.prototype.slice.call(nl);

  // Set display of yard-js2 constant sections, which will be first in the nodelist
  if (nl.length > 0) {
    grandParent = nl[0].parentElement.parentElement;
    if (grandParent.id === 'js_h2_cv')
      grandParent.nextElementSibling.style.display = (fullVis) ? '' : 'none';
  }

  //set textContent ( 'expand' or 'collapse' ) of all toggle elements
  t = state.summaryCollapsed;
  for (var i = 0, el; el = nl[i]; i++) {
    el.textContent =  t;
  }
}

/* Adds small unicode space characters to long document titles, long class names
 * in particular.  This allows the text to wrap.  Without this, the long names
 * would force the document window width larger than the UI accomodates.
 * @param content [HTMLDIVElement] the content div element
 */
function addWhiteSpace(content) {
  var title = content.querySelector('h1'),
      spc = String.fromCharCode(8202);

  if (title && title.textContent.length > 40) {
    for (var i = 0, node; node = title.childNodes[i]; i++) {
      if (node.nodeType === 3) {
        node.nodeValue = node.nodeValue.replace(/::/g, '::' + spc);
        node.nodeValue = node.nodeValue.replace(/([a-z])([A-Z])/g, "\$1" + spc + "\$2");
      }
    }
  }
}

/* removes empty docstring divs
 * @param content [HTMLDIVElement] the content div element
 */
function removeEmptyDocString(content) {
  var nl = content.querySelectorAll('div.docstring, div.tags'),
      prnt;
  for (var i = 0, el; el = nl[i]; i++) {
    if (el.textContent.trim() === '') {
      prnt = el.parentElement;
      prnt.removeChild(el);
    }
  }
  nl = null;
}

//} @!endgroup

//{ @!group Window & Main Doc Event Handlers

/* Event handler for main header button click.  At present, the only active
 * controls are the four Pane control button, which are called via oPane.mainClk.
 */
function clkHdrBtn(e) {
  var tgt = e.target,
      tag = tgt.tagName,
      cls = tgt.className,
      id = tgt.id;

  if (tag === 'CODE'  || tag === 'svg') {
    // move up to button (code element used for the triangles)
    tgt = tgt.parentElement;
    tag = tgt.tagName;
    cls = tgt.className;
    id  = tgt.id;
  } else if (tag === 'rect' || tag === 'path') {
    tgt = tgt.parentElement.parentElement;
    tag = tgt.tagName;
    cls = tgt.className;
    id  = tgt.id;
  }

  if (tgt instanceof HTMLButtonElement) {
    if (tgt.disabled) return;
    if (id === 'src') {
      state.showSource = (_id('src').className === 'c');
      if (storage) storage.yardState = JSON.stringify(state);
      sourceShowHide(eContent, state.showSource);
    } else if ( HDR_PANE_BTNS.indexOf(id) > -1 ) {
      oPane.mainClk(id);
    }
  } else {
  }
}

/* Event handler for main header Namespace/Object path click.  Locates the URL,
 * then calls gotoDoc.
 */
function clkMenu(e) {
  var tgt = e.target,
      url;
  if (tgt.tagName === 'A' && !e.ctrlKey) {
    url = tgt.href;
    if (url) {
      clickedBy = CB_OBJ_PATH;
      if ( /github\.io/i.test(url) && /\/_index\.html$/.test(url) )
        url = url.replace(/\/_index\.html$/, '/y_index.html');
      gotoDoc(url);
      e.stopPropagation();
      e.preventDefault();
      return false;
    }
  }
}

/* Event handler for content click.  Manages the content UI. */
function clkContent(e) {
  var tgt = e.target,
      tag = tgt.tagName,
      cls = tgt.className,
      id = tgt.id,
      eA,
      hash,
      prnt,
      len,
      cancel = false,
      aCls = ['toggleDefines', 'inheritanceTree', 'toggleSource',
      'summary_signature', 'summary_toggle'];

  if ( aCls.indexOf(cls) === -1) {
    if (aCls.indexOf(tgt.parentElement.className) > -1) {
      tgt = tgt.parentElement;
      cls = tgt.className;
    } else if (aCls.indexOf(tgt.parentElement.parentElement.className) > -1) {
      tgt = tgt.parentElement.parentElement;
      cls = tgt.className;
    }
  }

  switch (cls) {
  case 'toggleDefines':
    // top of page 'Defined In:'
    prnt = tgt.parentElement;
    if (tgt.textContent === 'more...') {
      tgt.textContent = '(less)';
      prnt.querySelector('span.defines').style.display = 'inline';
    } else {
      tgt.textContent = 'more...';
      prnt.querySelector('span.defines').style.display = '';
    }
    cancel = true;
    break;
  case 'inheritanceTree':
    // top of page 'Inherits:'
    var ul = tgt.previousElementSibling,
        single = ul.previousElementSibling;
    prnt = tgt.parentElement;
    if (tgt.textContent === 'show all') {
      ul.style.display = 'block';
      single.style.display = 'none';
      tgt.textContent = 'hide';
      prnt.classList.add('box_c');
    } else {
      ul.style.display = 'none';
      single.style.display = 'block';
      tgt.textContent = 'show all';
      prnt.classList.remove('box_c');
    }
    cancel = true;
    break;
  case 'toggleSource':
    var sourceCode = tgt.parentElement.parentElement.querySelector('div.source_code');
    if (tgt.textContent === 'view source') {
      tgt.textContent = 'hide source';
      sourceCode.classList.remove(CN_HIDDEN);
    } else {
      tgt.textContent = 'view source';
      sourceCode.classList.add(CN_HIDDEN);
    }
    cancel = true;
    break;
  case 'summary_signature':
    if (eA = tgt.querySelector('a')) {
      cancel = true;
      clickedBy = CB_CONTENT;
      clickedTop = tgt.getBoundingClientRect().top - fwHdrHgt;
      if (e.ctrlKey) {
        window.open(eA.href, '_blank');
        cancel = true;
      } else if (hash = eA.hash) {
        hash = decodeURIComponent(hash.slice(1));
        gotoDoc(eA.pathname + '#' + hash);
      } else gotoDoc(eA.href);
    }
    break;
  case 'summary_toggle':
    summaryToggle(tgt);
    cancel = true;
    break;
  }

  // Index page 'Listings'
  if (tag === 'LI' && (cls === 'r1' || cls === 'r2') ) {
    tgt = tgt.firstElementChild;
    tag = 'A';
  }

  if (!cancel && !e.ctrlKey) {
    clickedTop = tgt.getBoundingClientRect().top - fwHdrHgt;
    if (tag === 'A') {
      eA = tgt;
      cancel = true;
    } else if (eA = tgt.parentElement) {
      if (eA.tagName === 'A') {
        cancel = true;
      } else if (eA = eA.parentElement) {
        if (eA.tagName === 'A') cancel = true;
      }
    }
    if (cancel && eA) {
      clickedBy = CB_CONTENT;
      if (hash = eA.hash) {
        var a = eA.href.split('#');
        cancel = gotoDoc( a[0] + '#' + decodeURIComponent(a[1]) );
      } else
        cancel = gotoDoc(eA.href);
    }
  }
  if (cancel) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
}

/* Event handler for browser forward & back navigation events. */
function popState(e) {
  var loc;
  clickedBy = CB_POP_STATE;
  if (e.state) {
    gotoDoc(e.state.url);
  } else {
    loc = window.location;
    gotoDoc(loc.pathname + loc.hash);
  }
  e.preventDefault();
}

/* Event handler for window keydown, used for Esc & Ctrl-Alt combinations. */
function winKeyDown(e) {
  var key = String.fromCharCode(e.which),
      keyU = key.toUpperCase(),
      keyD = key.toLowerCase(),
      isCtrlAlt = e.altKey && e.ctrlKey,
      url,
      cancel;

  if (e.which === 27) {
    var sb;
    if (sb = _id('list_search_text') ) {
      if (sb.value > '') {
        _id('list_search_text').value = null;
        oList.searchClear();
      }
    }
    eContent.focus();
    cancel = true;

  } else if (!isCtrlAlt) {
    return;

  } else if (WIN_PANE_KD.indexOf(keyD) > -1 ) {
    oPane.mainKD(keyD);
    cancel = true;

  } else {
    switch (keyD) {
    case 'i':
      var nl = document.querySelectorAll('#y_menu a');
      for (var i = 0, el; el = nl[i]; i++) {
        if (/^index/i.test(el.textContent)) {
          url = el.href;
          clickedBy = CB_OBJ_PATH;
          if ( /github\.io/i.test(url) && /\/_index\.html$/.test(url) )
            url = url.replace(/\/_index\.html$/, '/y_index.html');
          cancel = true;
          gotoDoc(url);
          break;
        }
      }
      break;
    }
  }
  if (cancel) {
    isWinKPTimeOut = true;
    e.preventDefault();
    e.stopPropagation();
    setTimeout( function(){ isWinKPTimeOut = false; }, 1000);
    return false;
  }
}

/* Event handler window keypress, at present, only used for jumping locations in
 * the Method List.  Does not handle Ctrl-Alt, which uses winKeyDown.
 */
function winKeyPress(e) {
  var key = String.fromCharCode(e.which),
      cancel;

//console.log('winKP ' + key + ' ' + keyU + ' ' + keyD);
//console.log('winKP alt ' + e.altKey + '   ctrl ' + e.ctrlKey);

  if (isWinKPTimeOut || document.activeElement === _id('list_search_text') )
    return;

  // Add main keyPress code here

  if (e.altKey || e.ctrlKey) return;

  if ( RE_LIST_SEARCH.test(key) ) {
    oList.keyPress(key);
    cancel = true;
  }
  if (cancel) {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }
}

/* Event handler for window resize. Sets up a timer so the screen refreshes are limited. */
function winResize() {
  var eAct = document.activeElement,
      contentS = eContent.style;

  if (contentS && contentS.fontSize !== '') {
    //console.log('set_FS ' + contentS.fontSize + ' ' + (typeof contentS.fontSize));
    contentS.fontSize = '';
  }

  if (isTouch && eAct && eAct.id === 'list_search_text' &&
      window.innerWidth === winWidth) {
    eAct.focus();
  } else if (winResizeTmrId) {
    window.clearTimeout(winResizeTmrId);
    winResizeTmrId = window.setTimeout( domLayout, 200);
  } else {
    winResizeTmrId = window.setTimeout( domLayout, 200);
  }
}

//} @!endgroup

//{ @!group Load & Layout

/* Debug to small text area in main header */
function hdrDbg(str) {
  if (!dbgYDebug) return;
  var t = _id('y_debug').textContent.split(' ');
  t[0] = str;
  _id('y_debug').textContent = t.join(' ');
}

/* Enlarges the main content font if the device is a touch device and screen
 * width is greater than 95 monospaced characters.
 */
function setZoom(contentS) {
  var panesOk = !(oList.d.docked && oList.d.vis) && !(oToc.d.docked && oToc.d.vis);
  if (panesOk && winZoom !== null) {
    if (!isZoomed ) {
      contentS.fontSize = winZoom + 'px';
      isZoomed = true;
    }
  } else if (isZoomed) {
    contentS.fontSize = '';
    isZoomed = false;
  }
}

/* Called on first load and anytime the window is resized */
function domLayout() {
  var winHeightLast = winHeight,
      winTypeLast = winType,
      charWid = 0,
      dockDisabled = false;

  winHeight = window.innerHeight;
  winWidth  = window.innerWidth;

  charWid = Math.floor(50.0 * winWidth / px50Char);

  if (100 < charWid && charWid < 120 && isTouch)
    winZoom = Math.round( Math.min( 18, (FS * charWid/ZOOM)),1);
  else {
    winZoom = null;
    eContent.style.fontSize = '';
  }

  if      (charWid > MED_LRG)  winType = 2;
  else if (charWid > SML_MED)  winType = 1;
  else { dockDisabled = true;  winType = 0; }

  _id('list_loc').disabled = dockDisabled;
  _id('toc_loc').disabled = dockDisabled;

  if (winHeight !== winHeightLast) {
    if (isVHBad) vhFix();
    if (winHeight < clickedTop) {
      clickedTop = 0.6 * winHeight;
    }
  }

  if (winType !== winTypeLast) oPane.locSet(winTypeLast);
  setZoom(eContent.style);

  if (dbgYDebug) _id('y_debug').textContent = ' ' + charWid + '  ' + winType;
}

/* Called anytime a new doc is loaded */
function docReady() {
  eContent.tabIndex = 1;
  _id('y_menu').addEventListener('click', clkMenu, false);
  eContent.addEventListener('click', clkContent, false);
}

/* Hooks events on first doc load; these events are not affected when a doc
 * is loaded via XMLHttpRequest.
 */
function hookEvents() {
  window.addEventListener('keydown' , winKeyDown  , false);
  window.addEventListener('keypress', winKeyPress , false);
  window.addEventListener('resize'  , winResize   , false);
  window.addEventListener('popstate', popState    , false);
  _id('hdr_button').addEventListener('click' , clkHdrBtn , false);
}

/* Read options */
function readOptions() {
  if (_t2Info !== undefined) {
    if (_t2Info.hasOwnProperty('NSEP'))
      t2Opts.NSEP = _t2Info.NSEP.trim();
    if (_t2Info.hasOwnProperty('customHeaderId'))
      t2Opts.customHeaderId =  _t2Info.customHeaderId.trim();
  }
}

function updateCSS() {
  var wid, t;
  if (oCSSRuleTable instanceof CSSRule) {
    wid = window.innerWidth;
    if (oList.d.docked && oList.d.vis)
      wid -= oList.e.getBoundingClientRect().width;
    if (oToc.d.docked && oToc.d.vis)
      wid -= oToc.e.getBoundingClientRect().width;
    if (isZoomed) {
      wid -= 2.0 * winZoom;
    } else {
      wid -= 2.0 * (px30em)/30.0;
    }
    oCSSRuleTable.maxWidth = Math.floor(wid) + 'px';
  }
}

/* Changes cssRules to pixels for devices with bad vh
 * units, see isVHBad in {eDOMContent}
 */
function vhFix() {
  var i, j, maxH,
      fw_hdr = _id(t2Opts.customHeaderId),
      winH = winHeight - 2 - (fw_hdr ? fw_hdr.offsetHeight : 0),
      ss,
      cntr,
      cssRules,
      cssRule;

  for (i = 0; ss = document.styleSheets[i]; i++) {
    if ( /y_list\.css$/.test(ss.href) ) {
      cssRules = ss.cssRules;
      cntr = 0;
      for (j = 0; cssRule = cssRules[j]; j++) {
        // style
        switch (cssRule.selectorText) {
        case '#tbl_cont':
          cssRule.style.height = winH + 'px';
          cntr ++;
          break;
        case '#y_list.d, #y_toc.d':
          cssRule.style.height = winH + 'px';
          cntr ++;
          break;
        case '#y_list.f #list_nav':
          maxH = (winH - oList.hdrHeight - FLT_HGT * px30em / 30.0).toFixed(0);
          cssRule.style.maxHeight = maxH + 'px';
          cntr ++;
          break;
        case '#y_toc.f #toc_nav':
          maxH = (winH - oToc.hdrHeight - FLT_HGT * px30em / 30.0).toFixed(0);
          cssRule.style.maxHeight = maxH + 'px';
          cntr ++;
          break;
        }
        if (cntr === 4) break;
      }
    } else if ( /y_style\.css$/.test(ss.href)) {
      cssRules = ss.cssRules;
      cntr = 0;
      for (j = 0; cssRule = cssRules[j]; j++) {
        switch (cssRule.selectorText) {
        case '#tbl_cont':
          cssRule.style.height = winH + 'px';
          cntr ++;
          break;
        case '#y_main':
          cssRule.style.height = winH + 'px';
          cntr ++;
          break;
        case '#content':
          maxH = ( winH - oToc.hdrHeight).toFixed(0);
          cssRule.style.height = maxH + 'px';
          cntr ++;
          break;
        }
        if (cntr === 3) break;
      }
    }
  }
}

/* Set html of SVG wait element, no need to have it in all of the content
 * pages
 */
function waitHTML() {
  var eWait = _id('y_wait');
  if (isTouch) {
    eWait.setAttribute('viewBox', '0 0 135 45');
    waitWidth =  9.0 * px30em/30.0; // 135 / 15
    eWait.innerHTML =
      "<text opacity='0.6' x='67' y='30' text-anchor='middle'>Waiting...</text>";
  } else {
    eWait.setAttribute('viewBox', '0 0 90 90');
    waitWidth =  6.0 * px30em/30.0; // 90 / 15
    eWait.innerHTML =
      "<path opacity='0.1' d='M 58.46 7.28 L 62.16 8.81 52.59 31.91 48.89 30.38' />" +
      "<path opacity='0.1' d='M 71.87 15.3 L 74.7 18.13 57.02 35.81 54.19 32.98' />" +
      "<path opacity='0.1' d='M 81.19 27.84 L 82.72 31.54 59.62 41.11 58.09 37.41' />" +
      "<path opacity='0.1' d='M 85 43 L 85 47 60 47 60 43' />" +
      "<path opacity='0.1' d='M 82.72 58.46 L 81.19 62.16 58.09 52.59 59.62 48.89' />" +
      "<path opacity='0.1' d='M 74.7 71.87 L 71.87 74.7 54.19 57.02 57.02 54.19' />" +
      "<path opacity='0.1' d='M 62.16 81.19 L 58.46 82.72 48.89 59.62 52.59 58.09' />" +
      "<path opacity='0.1' d='M 47 85 L 43 85 43 60 47 60' />" +
      "<path opacity='0.1' d='M 31.54 82.72 L 27.84 81.19 37.41 58.09 41.11 59.62' />" +
      "<path opacity='0.1' d='M 18.13 74.7 L 15.3 71.87 32.98 54.19 35.81 57.02' />" +
      "<path opacity='0.1' d='M 8.81 62.16 L 7.28 58.46 30.38 48.89 31.91 52.59' />" +
      "<path opacity='0.2' d='M 5 47 L 5 43 30 43 30 47' />" +
      "<path opacity='0.4' d='M 7.28 31.54 L 8.81 27.84 31.91 37.41 30.38 41.11' />" +
      "<path opacity='0.6' d='M 15.3 18.13 L 18.13 15.3 35.81 32.98 32.98 35.81' />" +
      "<path opacity='0.8' d='M 27.84 8.81 L 31.54 7.28 41.11 30.38 37.41 31.91' />" +
      "<path opacity='1.0' d='M 43 5 L 47 5 47 30 43 30' />";
  }
}

/* Event handler for DOMContentLoaded */
function eDOMContent(e) {
  var eAList,
      newToc,
      t, xhr, vhHgt;

  eContent = _id('content');
  e25vh    = _id('y_measure_vh');
  px30em   = _id('y_measure_em').offsetWidth;
  px50Char = _id('y_measure_50pre').offsetWidth;

  isServer = (_id('y_menu').className === 'server');

  eAList = _id('list_href').cloneNode(false);

  readOptions();
  waitHTML();
  waitHTML = undefined;

  winTitle = document.querySelector('head title').textContent;

  oPane.firstDOMLoad();

  if (eAList) {
    oList.libRoot = eAList.pathname.replace(/[^\/]+$/, '');
    xhrSend(eAList.href, oList.xhrCB);
  }

  aDOMCur.href  = window.location.href;
  aDOMNext.href = window.location.href;

  for (var i = 0, cssRules, ss; ss = document.styleSheets[i]; i++) {
    if ( /y_style\.css$/.test(ss.href)) {
      cssRules = ss.cssRules;
      cntr = 0;
      for (var j = 0, cssRule; cssRule = cssRules[j]; j++) {
        if (cssRule.selectorText === 'div.y_table') {
          oCSSRuleTable = cssRule;
          break;
        }
      }
    }
  }

  vhHgt = (4 * e25vh.getBoundingClientRect().width).toFixed(0);
  winHeight = window.innerHeight;
  if ( (winHeight + 1 < vhHgt) || _id(t2Opts.customHeaderId) ) {
    t = _id(t2Opts.customHeaderId);
    if (t) fwHdrHgt = t.offsetHeight;
    isVHBad = true;
    hdrDbg('isVHBad_True');
    vhFix();
  }

  domLayout();
  updateCSS();
  oList.e.tabIndex = 2;
  _id('src').className = state.showSource ? 'o' : 'c';

  newToc = addContent(eContent, document);
  oToc.nav.replaceChild(newToc.cloneNode(true), oToc.items);
  oToc.items = _id('toc_items');
  newToc = null;

  hookEvents();
  docReady();
  window.removeEventListener('DOMContentLoaded', eDOMContent);
  hookEvents = undefined;
}

//} @!endgroup

window.addEventListener('DOMContentLoaded', eDOMContent, false);

})(t2Info);
