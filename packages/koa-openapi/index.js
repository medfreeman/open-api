"use strict";
var __assign = (this && this.__assign) || Object.assign || function(t) {
    for (var s, i = 1, n = arguments.length; i < n; i++) {
        s = arguments[i];
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
            t[p] = s[p];
    }
    return t;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var openapi_framework_1 = require("openapi-framework");
var loggingPrefix = 'koa-openapi';
function initialize(args) {
    if (!args) {
        throw new Error(loggingPrefix + ": args must be an object");
    }
    if (!args.router) {
        throw new Error(loggingPrefix + ": args.router must be a koa router");
    }
    var exposeApiDocs = 'exposeApiDocs' in args ? !!args.exposeApiDocs : true;
    if (args.docsPath && typeof args.docsPath !== 'string') {
        throw new Error(loggingPrefix + ": args.docsPath must be a string when given");
    }
    if ('securityFilter' in args && typeof args.securityFilter !== 'function') {
        throw new Error(loggingPrefix + ": args.securityFilter must be a function when given");
    }
    var router = args.router;
    // Do not make modifications to this.
    var docsPath = args.docsPath || '/api-docs';
    var consumesMiddleware = args.consumesMiddleware;
    var errorMiddleware = typeof args.errorMiddleware === 'function' &&
        args.errorMiddleware.length === 4
        ? args.errorMiddleware
        : null;
    var securityFilter = args.securityFilter ||
        function defaultSecurityFilter(ctx, next) {
            ctx.status = 200;
            ctx.body = ctx.state.apiDoc;
        };
    var frameworkArgs = __assign({ apiDoc: args.apiDoc, featureType: 'middleware', name: loggingPrefix, paths: args.paths }, args);
    var framework = new openapi_framework_1["default"](frameworkArgs);
    framework.initialize({
        visitApi: function (apiCtx) {
            var basePaths = apiCtx.basePaths.map(toKoaBasePath);
            var _loop_1 = function (basePath) {
                if (exposeApiDocs) {
                    // Swagger UI support
                    router.get(basePath + docsPath, function (ctx, next) {
                        ctx.state.apiDoc = apiCtx.getApiDoc();
                        if (ctx.state.apiDoc.swagger) {
                            ctx.state.apiDoc.host = ctx.headers.host;
                            ctx.state.apiDoc.basePath =
                                basePath.length === 0 ? '/' : basePath;
                        }
                        securityFilter(ctx, next);
                    });
                }
                if (errorMiddleware) {
                    router.use(basePath, errorMiddleware);
                }
            };
            for (var _i = 0, basePaths_1 = basePaths; _i < basePaths_1.length; _i++) {
                var basePath = basePaths_1[_i];
                _loop_1(basePath);
            }
        },
        visitOperation: function (operationCtx) {
            var _this = this;
            var apiDoc = operationCtx.apiDoc;
            var methodName = operationCtx.methodName;
            var operationDoc = operationCtx.operationDoc;
            var operationHandler = operationCtx.operationHandler;
            var middleware = [].concat(operationCtx.additionalFeatures);
            if (operationDoc && operationCtx.allowsFeatures) {
                if (operationCtx.features.responseValidator) {
                    // add response validation middleware
                    // it's invalid for a method doc to not have responses, but the post
                    // validation will pick it up, so this is almost always going to be added.
                    middleware.unshift(function responseValidatorMiddleware(ctx) {
                        ctx.state.validateResponse = function (statusCode, response) {
                            return operationCtx.features.responseValidator.validateResponse(statusCode, response);
                        };
                    });
                }
                if (operationCtx.features.requestValidator) {
                    middleware.unshift(function requestValidatorMiddleware(ctx) {
                        var errors = operationCtx.features.requestValidator.validate(toOpenAPIRequest(ctx));
                        if (errors) {
                            ctx["throw"](errors.status, errors);
                        }
                    });
                }
                if (operationCtx.features.coercer) {
                    middleware.unshift(function coercerMiddleware(ctx) {
                        operationCtx.features.coercer.coerce(toOpenAPIRequest(ctx));
                    });
                }
                if (operationCtx.features.defaultSetter) {
                    middleware.unshift(function defaultMiddleware(ctx) {
                        operationCtx.features.defaultSetter.handle(toOpenAPIRequest(ctx));
                    });
                }
                if (operationCtx.features.securityHandler) {
                    middleware.push(createSecurityMiddleware(operationCtx.features.securityHandler));
                }
                if (consumesMiddleware && operationCtx.consumes) {
                    addConsumesMiddleware(middleware, consumesMiddleware, operationCtx.consumes);
                }
                if (operationCtx.features.contentTypeCheck) {
                    middleware.push(createContentTypeCheckMiddleware());
                }
                middleware.unshift(createAssignApiDocMiddleware(apiDoc, operationDoc));
            }
            middleware = middleware.concat(operationHandler);
            var basePaths = operationCtx.basePaths.map(toKoaBasePath);
            for (var _i = 0, basePaths_2 = basePaths; _i < basePaths_2.length; _i++) {
                var basePath = basePaths_2[_i];
                var koaPath = basePath +
                    '/' +
                    operationCtx.path
                        .substring(1)
                        .split('/')
                        .map(toPathParams)
                        .join('/');
                router[methodName](koaPath, function (ctx, next) { return __awaiter(_this, void 0, void 0, function () {
                    var _i, middleware_1, fn;
                    return __generator(this, function (_a) {
                        switch (_a.label) {
                            case 0:
                                _i = 0, middleware_1 = middleware;
                                _a.label = 1;
                            case 1:
                                if (!(_i < middleware_1.length)) return [3 /*break*/, 4];
                                fn = middleware_1[_i];
                                return [4 /*yield*/, fn(ctx, next)];
                            case 2:
                                _a.sent();
                                _a.label = 3;
                            case 3:
                                _i++;
                                return [3 /*break*/, 1];
                            case 4: return [2 /*return*/];
                        }
                    });
                }); });
            }
        }
    });
    return framework;
}
exports.initialize = initialize;
function addConsumesMiddleware(middleware, consumesMiddleware, consumes) {
    for (var i = consumes.length - 1; i >= 0; --i) {
        var mimeType = consumes[i];
        if (mimeType in consumesMiddleware) {
            var middlewareToAdd = consumesMiddleware[mimeType];
            middleware.unshift(middlewareToAdd);
        }
    }
}
function createAssignApiDocMiddleware(apiDoc, operationDoc) {
    return function assignApiDocMiddleware(ctx) {
        ctx.state.apiDoc = apiDoc;
        ctx.state.operationDoc = operationDoc;
    };
}
function createSecurityMiddleware(handler) {
    return function securityMiddleware(ctx) {
        handler.handle(ctx, function (err, result) {
            if (err) {
                if (err.challenge) {
                    ctx.set('www-authenticate', err.challenge);
                }
                ctx.status = err.status;
                if (typeof err.message === 'string') {
                    ctx.body = err.message;
                }
                else {
                    ctx.body = err.message;
                }
            }
        });
    };
}
function createContentTypeCheckMiddleware(operationDoc) {
    console.log("TCL: createContentTypeCheckMiddleware -> createContentTypeCheckMiddleware");
    return function contentTypeCheckMiddleware(ctx, next) {
        console.log("TCL: contentTypeCheckMiddleware -> ctx");
        var currentContentType = Object.keys(operationDoc.responses['200'].content)[0];
        ctx.request.type === currentContentType ? next() : ctx["throw"](415, 'Unsupported media type');
    };
}
function toOpenAPIRequest(ctx) {
    return {
        body: ctx.request.body,
        headers: ctx.request.headers,
        params: ctx.params,
        query: ctx.request.query
    };
}
function toPathParams(part) {
    return part.replace(/\{([^}]+)}/g, ':$1');
}
function toKoaBasePath(basePath) {
    return basePath.path;
}
