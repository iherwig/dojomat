/*jslint browser: true */
/*global define: true */

define([
    "routed/Request",
    "routed/Router",
    "dijit/registry",
    "dojo/_base/declare",
    "dojo/_base/lang",
    "dojo/has",
    "dojo/on",
    "dojo/query",
    "dojo/topic",
    "dojo/dom-construct",
    "./Notification",
    "dojo/domReady!"
], function (
    Request,
    Router,
    registry,
    declare,
    lang,
    has,
    on,
    query,
    topic,
    domConstruct,
    Notification
) {
    "use strict";

    // http://underscorejs.org - _.debounce(function, wait, [immediate])
    // Returns a function, that, as long as it continues to be invoked, will not
    // be triggered. The function will be called after it stops being called for
    // N milliseconds. If `immediate` is passed, trigger the function on the
    // leading edge, instead of the trailing.
    var debounce = function (func, wait, immediate) {
            var timeout;
            return function () {
                var context = this,
                    args = arguments,
                    later = function () {
                        timeout = null;
                        if (!immediate) {
                            func.apply(context, args);
                        }
                    },
                    callNow = immediate && !timeout;

                clearTimeout(timeout);
                timeout = setTimeout(later, wait);
                if (callNow) {
                    func.apply(context, args);
                }
            };
        },
        
        // Thanks has.js
        setHasHistory = function () {
            has.add('native-history-state', function (g) {
                return g.history !== undefined && g.history.pushState !== undefined;
            });
        },
        
        // Thanks has.js
        setHasLocalStorage = function () {
            has.add('native-localstorage', function (g) {
                var supported = false;
                try {
                    supported = g.localStorage !== undefined && g.localStorage.setItem !== undefined;
                } catch (e) {}
                return supported;
            });
        };

    return declare([], {

        router: new Router(),
        notification: new Notification(),
        styleElement: null,
        pageNodeId: 'page',

        run: function () {
            setHasHistory();
            setHasLocalStorage();
            this.setSubscriptions();
            this.registerPopState();
            this.handleState();
        },

        setCss: function (css) {
            if (!this.styleElement) {
                this.styleElement = window.document.createElement('style');
                this.styleElement.setAttribute("type", "text/css");
                query('head')[0].appendChild(this.styleElement);
            }

            if (this.styleElement.styleSheet) {
                this.styleElement.styleSheet.cssText = css; // IE
            } else {
                this.styleElement.innerHTML = '';
                this.styleElement.appendChild(window.document.createTextNode(css)); // the others
            }
        },

        setPageNode: function () {
            if (registry.byId(this.pageNodeId)) {
                registry.byId(this.pageNodeId).destroyRecursive();
            }
            
            domConstruct.create('div', { id: this.pageNodeId }, query('body')[0], 'first');
        },

        handleState: debounce(function () {
            var route = null, request = new Request(window.location.href);

            this.router.route(request);
            route = this.router.getCurrentRoute();

            if (route) {
                route.run(request);
            } else {
                this.makeNotFoundPage();
            }
        }, 500, true),

        registerPopState: function () {
            on(window, 'popstate', lang.hitch(this, function (ev) {
                this.handleState();
            }));
        },
        
        makePage: function (request, widget, loader) {
            var makePage = function (Page) {
                this.setPageNode();
                
                var page = new Page({
                    request: request,
                    router: this.router,
                    notification: this.notification.get()
                }, this.pageNodeId);
                
                this.notification.clear();
                page.startup();
            };
            
            if (loader) {
                require([loader], lang.hitch(this, function (loader) {
                    require([widget], lang.hitch(this, makePage));
                }));
            }
            else {
                require([widget], lang.hitch(this, makePage));
            }
        },
        
        makeNotFoundPage: function () {
            alert('Page not found');
        },

        makeErrorPage: function (error) {
            alert('An error has occured');
        },

        setSubscriptions: function () {
            topic.subscribe('dojomat/_AppAware/css', lang.hitch(this, function (args) {
                this.setCss(args.css);
            }));

            topic.subscribe('dojomat/_AppAware/title', lang.hitch(this, function (args) {
                window.document.title = args.title;
            }));

            topic.subscribe('dojomat/_AppAware/notification', lang.hitch(this, function (notification) {
                this.notification.set(notification);
            }));

            topic.subscribe('dojomat/_AppAware/error', lang.hitch(this, function (error) {
                this.makeErrorPage(error);
            }));

            topic.subscribe('dojomat/_AppAware/not-found', lang.hitch(this, function () {
                this.makeNotFoundPage();
            }));

            topic.subscribe('dojomat/_StateAware/push-state', lang.hitch(this, function (args) {
                history.pushState(args.state, args.title, args.url);
                this.handleState();
            }));
        }
    });
});