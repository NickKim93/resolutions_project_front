sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox"
 ], (Controller, MessageBox) => {
    "use strict";
 
    return Controller.extend("com-mdert-resolution-tracker-project.controller.App", {

        onBtnClick: function() {
            var oView = this.getView();
            var oUsername = oView.byId("user").getValue();
            var oPassword = oView.byId("pwd").getValue();
            var oButton = this.getView().byId("btn");
            var that = this;

            oButton.setEnabled(false);
            
            if (!oUsername || !oPassword) {
                MessageBox.error("Username and password are required!");
                return;
            }
            
            var oPayload = {
                username: oUsername,
                password: oPassword
            };
            
            
            $.ajax({
                url: "http://localhost:5500/auth",
                method: "POST",
                contentType: "application/json",
                data: JSON.stringify(oPayload),
                xhrFields: {
                    withCredentials: true
                },
                success: function(data) {

                    sessionStorage.setItem("accessToken", data.accessToken);
                    sessionStorage.setItem("employeeId", data.employeeId);

                    MessageBox.success("Login successful!", {
                        onClose: () => {
                            var oRouter = sap.ui.core.UIComponent.getRouterFor(that);
                            oRouter.navTo("page");
                        }
                    });
                    oButton.setEnabled(true);
                },
                error: function(err) {
                    MessageBox.error("Login failed. Please check your username and password.");
                    oButton.setEnabled(true);
                }
            });
        }
    });
 });