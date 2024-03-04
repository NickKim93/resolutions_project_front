sap.ui.define([
    "sap/ui/core/UIComponent",
    "./util/TokenHandler",
    "sap/m/MessageBox"
], (UIComponent, TokenHandler, MessageBox) => {
    "use strict";

    return UIComponent.extend("com-mdert-resolution-tracker-project", {

        metadata: {
            manifest: "json"
        },

        init() {

            UIComponent.prototype.init.apply(this, arguments);

            var oRouter = this.getRouter();
            oRouter.initialize();
            this.setupGlobalAjaxErrorHandler();
        },

        refreshAccessToken: function () {
            return TokenHandler.refreshAccessToken(this);
        },
        setupGlobalAjaxErrorHandler: function () {
            console.log("setupGlobalAjaxErrorHandler triggered");
            var that = this;
            $(document).ajaxError(function (event, jqxhr, settings, thrownError) {
                if (jqxhr.status === 401) {
                    // Prevent retrying more than once
                    if (!settings.retryAttempt) {
                        settings.retryAttempt = true; // Mark the retry attempt
                        that.refreshAccessToken().then(function (newToken) {
                            settings.headers.Authorization = "Bearer " + newToken;
                            $.ajax(settings); // Retry the original request
                        }).catch(function (error) {
                            // If token refresh fails, redirect to login page
                            MessageBox.error("Session expired. Please login again.", {
                                onClose: function () {
                                    that.getRouter().navTo("login");
                                }
                            });
                        });
                    } else {
                        MessageBox.error("Session expired. Please login again.", {
                            onClose: function () {
                                that.getRouter().navTo("login");
                            }
                        });
                    }
                }
            });
        },

        redirectToLoginPage: function () {
            var oRouter = this.getRouter();
            oRouter.navTo("login");
        }
    });
});