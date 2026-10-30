"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/is-weakref";
exports.ids = ["vendor-chunks/is-weakref"];
exports.modules = {

/***/ "(rsc)/./node_modules/is-weakref/index.js":
/*!******************************************!*\
  !*** ./node_modules/is-weakref/index.js ***!
  \******************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("\n\nvar callBound = __webpack_require__(/*! call-bound */ \"(rsc)/./node_modules/call-bound/index.js\");\n\n// eslint-disable-next-line no-extra-parens\nvar $deref = /** @type {<T extends WeakKey>(thisArg: WeakRef<T>) => T | undefined} */ (callBound('WeakRef.prototype.deref', true));\n\n/** @type {import('.')} */\nmodule.exports = typeof WeakRef === 'undefined'\n\t? function isWeakRef(_value) { // eslint-disable-line no-unused-vars\n\t\treturn false;\n\t}\n\t: function isWeakRef(value) {\n\t\tif (!value || typeof value !== 'object') {\n\t\t\treturn false;\n\t\t}\n\t\ttry {\n\t\t\t// @ts-expect-error\n\t\t\t$deref(value);\n\t\t\treturn true;\n\t\t} catch (e) {\n\t\t\treturn false;\n\t\t}\n\t};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvaXMtd2Vha3JlZi9pbmRleC5qcyIsIm1hcHBpbmdzIjoiQUFBYTs7QUFFYixnQkFBZ0IsbUJBQU8sQ0FBQyw0REFBWTs7QUFFcEM7QUFDQSx3QkFBd0IsMkRBQTJEOztBQUVuRixXQUFXLGFBQWE7QUFDeEI7QUFDQSxnQ0FBZ0M7QUFDaEM7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSxJQUFJO0FBQ0o7QUFDQTtBQUNBIiwic291cmNlcyI6WyJEOlxcc291cmNlXFxkbWFfdmdfaWZtXFxkbWEtbmV4dGpzXFxub2RlX21vZHVsZXNcXGlzLXdlYWtyZWZcXGluZGV4LmpzIl0sInNvdXJjZXNDb250ZW50IjpbIid1c2Ugc3RyaWN0JztcblxudmFyIGNhbGxCb3VuZCA9IHJlcXVpcmUoJ2NhbGwtYm91bmQnKTtcblxuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIG5vLWV4dHJhLXBhcmVuc1xudmFyICRkZXJlZiA9IC8qKiBAdHlwZSB7PFQgZXh0ZW5kcyBXZWFrS2V5Pih0aGlzQXJnOiBXZWFrUmVmPFQ+KSA9PiBUIHwgdW5kZWZpbmVkfSAqLyAoY2FsbEJvdW5kKCdXZWFrUmVmLnByb3RvdHlwZS5kZXJlZicsIHRydWUpKTtcblxuLyoqIEB0eXBlIHtpbXBvcnQoJy4nKX0gKi9cbm1vZHVsZS5leHBvcnRzID0gdHlwZW9mIFdlYWtSZWYgPT09ICd1bmRlZmluZWQnXG5cdD8gZnVuY3Rpb24gaXNXZWFrUmVmKF92YWx1ZSkgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVudXNlZC12YXJzXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdDogZnVuY3Rpb24gaXNXZWFrUmVmKHZhbHVlKSB7XG5cdFx0aWYgKCF2YWx1ZSB8fCB0eXBlb2YgdmFsdWUgIT09ICdvYmplY3QnKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHRyeSB7XG5cdFx0XHQvLyBAdHMtZXhwZWN0LWVycm9yXG5cdFx0XHQkZGVyZWYodmFsdWUpO1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fTtcbiJdLCJuYW1lcyI6W10sImlnbm9yZUxpc3QiOlswXSwic291cmNlUm9vdCI6IiJ9\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/is-weakref/index.js\n");

/***/ })

};
;