sap.ui.define([
	"sap/m/library",
	"sap/ui/core/mvc/Controller",
	"sap/ui/core/Item",
	"sap/ui/model/json/JSONModel",
	"sap/m/upload/Uploader",
	"sap/m/MessageBox"
], function (MobileLibrary, Controller, Item, JSONModel, Uploader, MessageBox) {
	"use strict";

	return Controller.extend("com-mdert-resolution-tracker-project.controller.Page", {
		onInit: function () {
			var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
    		oRouter.getRoute("page").attachPatternMatched(this.onRouteMatched, this);
			var oUploadSet = this.byId("UploadSet");

			this.getView().setModel(new JSONModel());
			

			// Modify "add file" button
			oUploadSet.getDefaultFileUploader().setButtonOnly(false);
			oUploadSet.getDefaultFileUploader().setTooltip("");
			oUploadSet.getDefaultFileUploader().setIconOnly(true);
			oUploadSet.getDefaultFileUploader().setIcon("sap-icon://attachment");
			oUploadSet.attachUploadCompleted(this.onUploadCompleted.bind(this));
			
		},
		onRouteMatched: function(oEvent) {
			var accessToken = sessionStorage.getItem("accessToken");
			var employeeId = sessionStorage.getItem("employeeId");
			if (accessToken) {
				this.fetchEmployeeData(accessToken, employeeId);
			} else {	
				MessageBox.error("Access token doesn't exist. Please login again", {
					onClose: () => {
						var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
						oRouter.navTo("login");
					}
				});
			}
		},
		fetchEmployeeData: function(accessToken, employeeId) {
			var url = "http://localhost:5500/employees/" + employeeId;
			$.ajax({
				url: url,
				method: "GET",
				headers: {
					"Authorization": "Bearer " + accessToken
				},
					success: function(response) {
						var mergedFiles = response.receipts.map(function(item) {
							return { ...item, fileType: "receipt", isNew: false, isEditable: false, isRemovable: false };
						}).concat(response.spendingResolutions.map(function(item) {
							return { ...item, fileType: "spendingResolution", isNew: false, isEditable: false, isRemovable: false };
						}));
						var oModel = new sap.ui.model.json.JSONModel(response);
						this.getView().setModel(oModel, "employeeData");
						var oModel2 = new sap.ui.model.json.JSONModel(mergedFiles);
						this.getView().setModel(oModel2, "files");
						console.log('oModel',oModel2);
						console.log(this.getView().getModel("files"));
					}.bind(this),
				error: function(xhr, textStatus, error) {
					// Since the global error handler takes care of token refresh, 
					// only handle non-authentication related errors here.
					if (xhr.status !== 401) {
						MessageBox.error("An error occurred while fetching employee data.", {
							onClose: () => {
								var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
								oRouter.navTo("login");
							}
						});
					}
				}.bind(this)
			});
		},
		onUploadSelectedButton: function () {
			
			var accessToken = sessionStorage.getItem("accessToken");
			var oUploadSet = this.byId("UploadSet");
			var aFiles = oUploadSet.getSelectedItems();
			console.log(aFiles);
			
			var aUploadPromises = [];

			aFiles.forEach((oItem) => {
				var oFile = oItem.getFileObject();
				if (oFile) {
					var oFormData = new FormData();
					oFormData.append("file", oFile);
					var uploadPromise = fetch("http://localhost:5500/upload", {
						method: "POST",
						body: oFormData,
						headers: {
							"Authorization": "Bearer " + accessToken,
						}
					});
					aUploadPromises.push(uploadPromise);
				}
			});

			Promise.all(aUploadPromises.map(p => p.then(res => res.ok ? res.json() : Promise.reject(new Error('Upload failed')))))
				.then(data => {
					// All files uploaded successfully
					console.log("Success:", data);
					sap.m.MessageBox.success(data.length + " file(s) were uploaded.", {
						onClose: function() {
							// Trigger refresh here
							this.refreshModelAndView();
						}.bind(this)
					});
				})
				.catch(error => {
					// At least one file failed to upload
					console.error("Error:", error);
					sap.m.MessageBox.error("An error occurred during the upload.");
				});
			
		},
		refreshModelAndView: function() {
			window.location.reload(true);
		},
		onDownloadSelectedButton: function () {
			console.log("onDownloadSelectedButton");
			var oUploadSet = this.byId("UploadSet");

			oUploadSet.getItems().forEach(function (oItem) {
				if (oItem.getListItem().getSelected()) {
					oItem.download(true);
				}
			});
		},
		onSelectionChange: function() {
			var oUploadSet = this.byId("UploadSet");
			// If there's any item selected, sets version button enabled
			// var oVersionBtn = this.byId("versionButton");
			var oUploadBtn = this.byId("uploadSelectedButton");
			var oDownloadBtn = this.byId("downloadSelectedButton");
			if (oUploadSet.getSelectedItems().length > 0) {
				oUploadBtn.setEnabled(true);
				oDownloadBtn.setEnabled(true);
				// if (oUploadSet.getSelectedItems().length === 1) {
				// 	oVersionBtn.setEnabled(true);
				// } else {
				// 	oVersionBtn.setEnabled(false);
				// }
			} else {
				// oVersionBtn.setEnabled(false);
				oUploadBtn.setEnabled(false);
				oDownloadBtn.setEnabled(false);
			}
		},
		// Add below element to Page.view if you want to enable VersionUpload
		//<Button id="versionButton" enabled="false" text="Upload a new version" press="onVersionUpload"/>
		onVersionUpload: function(oEvent) {
			console.log("onVersionUpload");
			var oUploadSet = this.byId("UploadSet");
			this.oItemToUpdate = oUploadSet.getSelectedItem()[0];
			oUploadSet.openFileDialog(this.oItemToUpdate);
		},
		onUploadCompleted: function(oEvent) {
			this.oItemToUpdate = null;
			// this.byId("versionButton").setEnabled(false);
		},
		onLogout: function () {
			sessionStorage.removeItem("accessToken");
			this.getOwnerComponent().getRouter().navTo("login");
		},
		onMediaTypeMismatch: function(oEvent) {
			var sFileName = oEvent.getParameter("item").getFileName();
			sap.m.MessageBox.warning("The file '" + sFileName + "' is not of an allowed type. Please upload only the supported file types.");
		}
	});
});