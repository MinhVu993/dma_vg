"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/is-async-function";
exports.ids = ["vendor-chunks/is-async-function"];
exports.modules = {

/***/ "(rsc)/./node_modules/is-async-function/index.js":
/*!*************************************************!*\
  !*** ./node_modules/is-async-function/index.js ***!
  \*************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("\n\nvar callBound = __webpack_require__(/*! call-bound */ \"(rsc)/./node_modules/call-bound/index.js\");\nvar safeRegexTest = __webpack_require__(/*! safe-regex-test */ \"(rsc)/./node_modules/safe-regex-test/index.js\");\n\nvar toStr = callBound('Object.prototype.toString');\nvar fnToStr = callBound('Function.prototype.toString');\nvar isFnRegex = safeRegexTest(/^\\s*async(?:\\s+function(?:\\s+|\\()|\\s*\\()/);\n\nvar hasToStringTag = __webpack_require__(/*! has-tostringtag/shams */ \"(rsc)/./node_modules/has-tostringtag/shams.js\")();\nvar getProto = __webpack_require__(/*! get-proto */ \"(rsc)/./node_modules/get-proto/index.js\");\n\nvar getAsyncFunc = __webpack_require__(/*! async-function */ \"(rsc)/./node_modules/async-function/index.js\");\n\n/** @type {import('.')} */\nmodule.exports = function isAsyncFunction(fn) {\n\tif (typeof fn !== 'function') {\n\t\treturn false;\n\t}\n\tif (isFnRegex(fnToStr(fn))) {\n\t\treturn true;\n\t}\n\tif (!hasToStringTag) {\n\t\tvar str = toStr(fn);\n\t\treturn str === '[object AsyncFunction]';\n\t}\n\tif (!getProto) {\n\t\treturn false;\n\t}\n\tvar asyncFunc = getAsyncFunc();\n\treturn asyncFunc && asyncFunc.prototype === getProto(fn);\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvaXMtYXN5bmMtZnVuY3Rpb24vaW5kZXguanMiLCJtYXBwaW5ncyI6IkFBQWE7O0FBRWIsZ0JBQWdCLG1CQUFPLENBQUMsNERBQVk7QUFDcEMsb0JBQW9CLG1CQUFPLENBQUMsc0VBQWlCOztBQUU3QztBQUNBO0FBQ0E7O0FBRUEscUJBQXFCLG1CQUFPLENBQUMsNEVBQXVCO0FBQ3BELGVBQWUsbUJBQU8sQ0FBQywwREFBVzs7QUFFbEMsbUJBQW1CLG1CQUFPLENBQUMsb0VBQWdCOztBQUUzQyxXQUFXLGFBQWE7QUFDeEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXMiOlsiRDpcXHNvdXJjZVxcZG1hX3ZnX2lmbVxcZG1hLW5leHRqc1xcbm9kZV9tb2R1bGVzXFxpcy1hc3luYy1mdW5jdGlvblxcaW5kZXguanMiXSwic291cmNlc0NvbnRlbnQiOlsiJ3VzZSBzdHJpY3QnO1xuXG52YXIgY2FsbEJvdW5kID0gcmVxdWlyZSgnY2FsbC1ib3VuZCcpO1xudmFyIHNhZmVSZWdleFRlc3QgPSByZXF1aXJlKCdzYWZlLXJlZ2V4LXRlc3QnKTtcblxudmFyIHRvU3RyID0gY2FsbEJvdW5kKCdPYmplY3QucHJvdG90eXBlLnRvU3RyaW5nJyk7XG52YXIgZm5Ub1N0ciA9IGNhbGxCb3VuZCgnRnVuY3Rpb24ucHJvdG90eXBlLnRvU3RyaW5nJyk7XG52YXIgaXNGblJlZ2V4ID0gc2FmZVJlZ2V4VGVzdCgvXlxccyphc3luYyg/OlxccytmdW5jdGlvbig/Olxccyt8XFwoKXxcXHMqXFwoKS8pO1xuXG52YXIgaGFzVG9TdHJpbmdUYWcgPSByZXF1aXJlKCdoYXMtdG9zdHJpbmd0YWcvc2hhbXMnKSgpO1xudmFyIGdldFByb3RvID0gcmVxdWlyZSgnZ2V0LXByb3RvJyk7XG5cbnZhciBnZXRBc3luY0Z1bmMgPSByZXF1aXJlKCdhc3luYy1mdW5jdGlvbicpO1xuXG4vKiogQHR5cGUge2ltcG9ydCgnLicpfSAqL1xubW9kdWxlLmV4cG9ydHMgPSBmdW5jdGlvbiBpc0FzeW5jRnVuY3Rpb24oZm4pIHtcblx0aWYgKHR5cGVvZiBmbiAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRpZiAoaXNGblJlZ2V4KGZuVG9TdHIoZm4pKSkge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cdGlmICghaGFzVG9TdHJpbmdUYWcpIHtcblx0XHR2YXIgc3RyID0gdG9TdHIoZm4pO1xuXHRcdHJldHVybiBzdHIgPT09ICdbb2JqZWN0IEFzeW5jRnVuY3Rpb25dJztcblx0fVxuXHRpZiAoIWdldFByb3RvKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHZhciBhc3luY0Z1bmMgPSBnZXRBc3luY0Z1bmMoKTtcblx0cmV0dXJuIGFzeW5jRnVuYyAmJiBhc3luY0Z1bmMucHJvdG90eXBlID09PSBnZXRQcm90byhmbik7XG59O1xuIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6WzBdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/is-async-function/index.js\n");

/***/ })

};
;