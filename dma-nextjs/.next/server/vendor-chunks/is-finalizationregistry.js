"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
exports.id = "vendor-chunks/is-finalizationregistry";
exports.ids = ["vendor-chunks/is-finalizationregistry"];
exports.modules = {

/***/ "(rsc)/./node_modules/is-finalizationregistry/index.js":
/*!*******************************************************!*\
  !*** ./node_modules/is-finalizationregistry/index.js ***!
  \*******************************************************/
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

eval("\n\nvar callBound = __webpack_require__(/*! call-bound */ \"(rsc)/./node_modules/call-bound/index.js\");\n\n/** @type {undefined | ((value: ThisParameterType<typeof FinalizationRegistry.prototype.register>, ...args: Parameters<typeof FinalizationRegistry.prototype.register>) => ReturnType<typeof FinalizationRegistry.prototype.register>)} */\nvar $register = callBound('FinalizationRegistry.prototype.register', true);\n\n/** @type {import('.')} */\nmodule.exports = $register\n\t? function isFinalizationRegistry(value) {\n\t\tif (!value || typeof value !== 'object') {\n\t\t\treturn false;\n\t\t}\n\t\ttry {\n\t\t\t// @ts-expect-error TS can't figure out that it's always truthy here\n\t\t\t$register(value, {}, null);\n\t\t\treturn true;\n\t\t} catch (e) {\n\t\t\treturn false;\n\t\t}\n\t}\n\t// @ts-ignore unused var\n\t: function isFinalizationRegistry(value) { // eslint-disable-line no-unused-vars\n\t\treturn false;\n\t};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKHJzYykvLi9ub2RlX21vZHVsZXMvaXMtZmluYWxpemF0aW9ucmVnaXN0cnkvaW5kZXguanMiLCJtYXBwaW5ncyI6IkFBQWE7O0FBRWIsZ0JBQWdCLG1CQUFPLENBQUMsNERBQVk7O0FBRXBDLFdBQVcsNk5BQTZOO0FBQ3hPOztBQUVBLFdBQVcsYUFBYTtBQUN4QjtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBLHNCQUFzQjtBQUN0QjtBQUNBLElBQUk7QUFDSjtBQUNBO0FBQ0E7QUFDQTtBQUNBLDRDQUE0QztBQUM1QztBQUNBIiwic291cmNlcyI6WyJEOlxcc291cmNlXFxkbWFfdmdfaWZtXFxkbWEtbmV4dGpzXFxub2RlX21vZHVsZXNcXGlzLWZpbmFsaXphdGlvbnJlZ2lzdHJ5XFxpbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyIndXNlIHN0cmljdCc7XG5cbnZhciBjYWxsQm91bmQgPSByZXF1aXJlKCdjYWxsLWJvdW5kJyk7XG5cbi8qKiBAdHlwZSB7dW5kZWZpbmVkIHwgKCh2YWx1ZTogVGhpc1BhcmFtZXRlclR5cGU8dHlwZW9mIEZpbmFsaXphdGlvblJlZ2lzdHJ5LnByb3RvdHlwZS5yZWdpc3Rlcj4sIC4uLmFyZ3M6IFBhcmFtZXRlcnM8dHlwZW9mIEZpbmFsaXphdGlvblJlZ2lzdHJ5LnByb3RvdHlwZS5yZWdpc3Rlcj4pID0+IFJldHVyblR5cGU8dHlwZW9mIEZpbmFsaXphdGlvblJlZ2lzdHJ5LnByb3RvdHlwZS5yZWdpc3Rlcj4pfSAqL1xudmFyICRyZWdpc3RlciA9IGNhbGxCb3VuZCgnRmluYWxpemF0aW9uUmVnaXN0cnkucHJvdG90eXBlLnJlZ2lzdGVyJywgdHJ1ZSk7XG5cbi8qKiBAdHlwZSB7aW1wb3J0KCcuJyl9ICovXG5tb2R1bGUuZXhwb3J0cyA9ICRyZWdpc3RlclxuXHQ/IGZ1bmN0aW9uIGlzRmluYWxpemF0aW9uUmVnaXN0cnkodmFsdWUpIHtcblx0XHRpZiAoIXZhbHVlIHx8IHR5cGVvZiB2YWx1ZSAhPT0gJ29iamVjdCcpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0dHJ5IHtcblx0XHRcdC8vIEB0cy1leHBlY3QtZXJyb3IgVFMgY2FuJ3QgZmlndXJlIG91dCB0aGF0IGl0J3MgYWx3YXlzIHRydXRoeSBoZXJlXG5cdFx0XHQkcmVnaXN0ZXIodmFsdWUsIHt9LCBudWxsKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblx0Ly8gQHRzLWlnbm9yZSB1bnVzZWQgdmFyXG5cdDogZnVuY3Rpb24gaXNGaW5hbGl6YXRpb25SZWdpc3RyeSh2YWx1ZSkgeyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXVudXNlZC12YXJzXG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9O1xuIl0sIm5hbWVzIjpbXSwiaWdub3JlTGlzdCI6WzBdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(rsc)/./node_modules/is-finalizationregistry/index.js\n");

/***/ })

};
;