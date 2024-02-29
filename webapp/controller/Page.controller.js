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
			this.getView().setModel(new sap.ui.model.json.JSONModel(), "filteredFiles");

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
			var that = this;
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
						//storing fetched data
						that._originalFilesData = mergedFiles;
						var oModel = new sap.ui.model.json.JSONModel(response);
						this.getView().setModel(oModel, "employeeData");
						var oModel2 = new sap.ui.model.json.JSONModel(mergedFiles);
						this.getView().setModel(oModel2, "files");
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
		handleChange: function(oEvent) {
			console.log("handleChange trigger");
			var oDateRangeSelection = this.byId("DRS1");
			var oStartDate = oDateRangeSelection.getDateValue();
			var oEndDate = oDateRangeSelection.getSecondDateValue();

			// Adjust the end date to include the entire day
			oEndDate.setHours(23, 59, 59, 999);

			// Filter files based on the selected date range
			var aFilteredFiles = this._originalFilesData.filter(function(file) {
				var oFileDate = new Date(file.updatedAt);
				return oFileDate >= oStartDate && oFileDate <= oEndDate;
			});

			this.getView().getModel("files").setData(aFilteredFiles);
		},
		
		onUploadSelectedButton: function () {
			
			var accessToken = sessionStorage.getItem("accessToken");
			var oUploadSet = this.byId("UploadSet");
			var aFiles = oUploadSet.getSelectedItems();
			
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
					sap.m.MessageBox.error("An error occurred during the upload. Please reload the page", {
						onClose: function() {
							// Trigger refresh here
							this.refreshModelAndView();
						}.bind(this)
					});
				});

		},

		refreshModelAndView: function() {
			window.location.reload(true);
		},
		onDownloadSelectedButton: function () {
		
			console.log("onDownloadSelectedButton");
			var oUploadSet = this.byId("UploadSet");
			var accessToken = sessionStorage.getItem("accessToken");
		
			oUploadSet.getSelectedItems().forEach(function (oItem) {
				var fileName = oItem.getFileName(); // Adjust based on your actual data model
				var downloadUrl = `http://localhost:5500/download/${encodeURIComponent(fileName)}`;
		
				// Attempt to use $.ajax for the request
				$.ajax({
					url: downloadUrl,
					method: "GET",
					xhrFields: {
						responseType: 'blob' // Important for handling binary data
					},
					headers: {
						'Authorization': 'Bearer ' + accessToken
					},
					success: function(blob) {
						// Create a URL for the blob object and trigger download
						var url = window.URL.createObjectURL(blob);
						var a = document.createElement('a');
						a.href = url;
						a.download = fileName;
						document.body.appendChild(a);
						a.click(); 
						window.URL.revokeObjectURL(url);
						a.remove();
					},
					error: function(xhr, status, error) {
						console.error('Download error:', error);
						if (xhr.status !== 401) {
							sap.m.MessageBox.error("File was not found. Please reload the page and try again", {
								onClose: function() {
									// placeholder
								}
							});
						}
					}
				});
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