sap.ui.define([
    "sap/ui/core/UIComponent"
], function(UIComponent) {
    "use strict";

    return {
        /**
         * Refreshes the access token. On failure, redirects to the login page.
         */
        refreshAccessToken: function(controller) {
            return new Promise(function(resolve, reject) {
 
                jQuery.ajax({
                    url: "http://localhost:5500/refresh",
                    method: "GET",
                    xhrFields: {
                        withCredentials: true
                    },
                    success: function(data) {
                        sessionStorage.setItem("accessToken", data.accessToken);
                        resolve(data.accessToken);
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        console.log(errorThrown);
                        reject(new Error("Failed to refresh token"));
                    }
                });
            });
        }
    };
});
