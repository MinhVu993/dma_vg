"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/is-generator-function";
exports.ids = ["vendor-chunks/is-generator-function"];
exports.modules = {

/***/ "(rsc)/./node_modules/is-generator-function/index.js":
/*!*****************************************************!*\
  !*** ./node_modules/is-generator-function/index.js ***!
  \*****************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("\n\nvar callBound = __webpack_require__(/*! call-bound */ \"(rsc)/./node_modules/call-bound/index.js\");\nvar safeRegexTest = __webpack_require__(/*! safe-regex-test */ \"(rsc)/./node_modules/safe-regex-test/index.js\");\nvar isFnRegex = safeRegexTest(/^\\s*(?:function)?\\*/);\nvar hasToStringTag = __webpack_require__(/*! has-tostringtag/shams */ \"(rsc)/./node_modules/has-tostringtag/shams.js\")();\nvar getProto = __webpack_require__(/*! get-proto */ \"(rsc)/./node_modules/get-proto/index.js\");\n\nvar toStr = callBound('Object.prototype.toString');\nvar fnToStr = callBound('Function.prototype.toString');\n\nvar getGeneratorFunction = __webpack_require__(/*! generator-function */ \"(rsc)/./node_modules/generator-function/index.js\");\n\n/** @type {import('.')} */\nmodule.exports = function isGeneratorFunction(fn) {\n\tif (typeof fn !== 'function') {\n\t\treturn false;\n\t}\n\tif (isFnRegex(fnToStr(fn))) {\n\t\treturn true;\n\t}\n\tif (!hasToStringTag) {\n\t\tvar str = toStr(fn);\n\t\treturn str === '[object GeneratorFunction]';\n\t}\n\tif (!getProto) {\n\t\treturn false;\n\t}\n\tvar GeneratorFunction = getGeneratorFunction();\n\treturn GeneratorFunction && getProto(fn) === GeneratorFunction.prototype;\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvaXMtZ2VuZXJhdG9yLWZ1bmN0aW9uL2luZGV4LmpzIiwibWFwcGluZ3MiOiJBQUFhOztBQUViLGdCQUFnQixtQkFBTyxDQUFDLDREQUFZO0FBQ3BDLG9CQUFvQixtQkFBTyxDQUFDLHNFQUFpQjtBQUM3QztBQUNBLHFCQUFxQixtQkFBTyxDQUFDLDRFQUF1QjtBQUNwRCxlQUFlLG1CQUFPLENBQUMsMERBQVc7O0FBRWxDO0FBQ0E7O0FBRUEsMkJBQTJCLG1CQUFPLENBQUMsNEVBQW9COztBQUV2RCxXQUFXLGFBQWE7QUFDeEI7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsInNvdXJjZXMiOlsiRDpcXHNvdXJjZVxcZG1hX3ZnX2lmbVxcZG1hLW5leHRqc1xcbm9kZV9tb2R1bGVzXFxpcy1nZW5lcmF0b3ItZnVuY3Rpb25cXGluZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxudmFyIGNhbGxCb3VuZCA9IHJlcXVpcmUoJ2NhbGwtYm91bmQnKTtcbnZhciBzYWZlUmVnZXhUZXN0ID0gcmVxdWlyZSgnc2FmZS1yZWdleC10ZXN0Jyk7XG52YXIgaXNGblJlZ2V4ID0gc2FmZVJlZ2V4VGVzdCgvXlxccyooPzpmdW5jdGlvbik/XFwqLyk7XG52YXIgaGFzVG9TdHJpbmdUYWcgPSByZXF1aXJlKCdoYXMtdG9zdHJpbmd0YWcvc2hhbXMnKSgpO1xudmFyIGdldFByb3RvID0gcmVxdWlyZSgnZ2V0LXByb3RvJyk7XG5cbnZhciB0b1N0ciA9IGNhbGxCb3VuZCgnT2JqZWN0LnByb3RvdHlwZS50b1N0cmluZycpO1xudmFyIGZuVG9TdHIgPSBjYWxsQm91bmQoJ0Z1bmN0aW9uLnByb3RvdHlwZS50b1N0cmluZycpO1xuXG52YXIgZ2V0R2VuZXJhdG9yRnVuY3Rpb24gPSByZXF1aXJlKCdnZW5lcmF0b3ItZnVuY3Rpb24nKTtcblxuLyoqIEB0eXBlIHtpbXBvcnQoJy4nKX0gKi9cbm1vZHVsZS5leHBvcnRzID0gZnVuY3Rpb24gaXNHZW5lcmF0b3JGdW5jdGlvbihmbikge1xuXHRpZiAodHlwZW9mIGZuICE9PSAnZnVuY3Rpb24nKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdGlmIChpc0ZuUmVnZXgoZm5Ub1N0cihmbikpKSB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0aWYgKCFoYXNUb1N0cmluZ1RhZykge1xuXHRcdHZhciBzdHIgPSB0b1N0cihmbik7XG5cdFx0cmV0dXJuIHN0ciA9PT0gJ1tvYmplY3QgR2VuZXJhdG9yRnVuY3Rpb25dJztcblx0fVxuXHRpZiAoIWdldFByb3RvKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHZhciBHZW5lcmF0b3JGdW5jdGlvbiA9IGdldEdlbmVyYXRvckZ1bmN0aW9uKCk7XG5cdHJldHVybiBHZW5lcmF0b3JGdW5jdGlvbiAmJiBnZXRQcm90byhmbikgPT09IEdlbmVyYXRvckZ1bmN0aW9uLnByb3RvdHlwZTtcbn07XG4iXSwibmFtZXMiOltdLCJpZ25vcmVMaXN0IjpbMF0sInNvdXJjZVJvb3QiOiIifQ==\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/is-generator-function/index.js\n");

/***/ })

};
;