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
			oUploadSet.attachFileRenamed(this.onFileRenamed, this);
			this.renamedFiles = {};
			this.getView().setModel(new sap.ui.model.json.JSONModel(), "filteredFiles");

			// Modify "add file" button
			oUploadSet.getDefaultFileUploader().setButtonOnly(false);
			oUploadSet.getDefaultFileUploader().setTooltip("");
			oUploadSet.getDefaultFileUploader().setIconOnly(true);
			oUploadSet.getDefaultFileUploader().setIcon("sap-icon://attachment");
			oUploadSet.attachUploadCompleted(this.onUploadCompleted.bind(this));

			var oUploadBtn = this.byId("uploadSelectedButton");
			var oDownloadBtn = this.byId("downloadSelectedButton");
			var oDeleteBtn = this.byId("deleteSelectedButton");
			oUploadBtn.setEnabled(false);
			oDownloadBtn.setEnabled(false);	
			oDeleteBtn.setEnabled(false);
			
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
						let fileType = '';
						var mergedFiles = response.receipts.map(function(item, idx) {
							fileType = 'receipt';
							return that.fileFormat(item, fileType, idx);
						}).concat(response.spendingResolutions.map(function(item, idx) {
							fileType = 'spendingResolution';
							return that.fileFormat(item, fileType, idx);
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
		fileFormat: function (item, fileType, index) {
			
			item.updatedAt = this.convertDateFormat(item.updatedAt);
			item.createdAt = this.convertDateFormat(item.updatedAt);
			
			item.statuses = {
				createdAt: item.createdAt,
				updatedAt: item.updatedAt,
				fileSize: item.fileSize,
				index: index + 1,
			}
			return { ...item, fileType: fileType, isNew: false, isEditable: false, isRemovable: false };
		},

		handleChange: function(oEvent) {
			console.log("handleChange trigger");
			var oDateRangeSelection = this.byId("DRS1");
			var oStartDate = oDateRangeSelection.getDateValue();
			var oEndDate = oDateRangeSelection.getSecondDateValue();

			oEndDate.setHours(23, 59, 59, 999);

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
			var filesUploaded = 0;
			var uploadErrors = [];
			var that = this;
			
		
			aFiles.forEach((oItem) => {
				var oFile = oItem.getFileObject();
				if (oFile) {
					var oFormData = new FormData();
					var renamedFileName = this.renamedFiles[oFile.name];
					var filenameToUse = renamedFileName || oFile.name;
					console.log(filenameToUse);
					oFormData.append("file", oFile, filenameToUse);
					$.ajax({
						url: "http://localhost:5500/upload",
						type: "POST",
						processData: false,
						contentType: false,
						data: oFormData,
						headers: {
							"Authorization": "Bearer " + accessToken,
						},
						success: function(data) {
							filesUploaded++;
							if (filesUploaded === aFiles.length) {
								// All files uploaded successfully
								sap.m.MessageBox.success(filesUploaded + " file(s) were uploaded.", {
									onClose: function () {
										that.refreshModelAndView();
									}
								});
							}
						},
						error: function(xhr, status, error) {
							uploadErrors.push(error);
							console.error('Download error:', error);
							if (filesUploaded + uploadErrors.length === aFiles.length) {
								if (uploadErrors.length === aFiles.length) {
									if (xhr.status !== 401) {
										sap.m.MessageBox.error("An error occurred during the upload. Please reload the page", {
											onClose: function () {
												that.refreshModelAndView();
											}
										});
									}
								} else {
									sap.m.MessageBox.warning(filesUploaded + " file(s) were uploaded successfully, but " + uploadErrors.length + " failed.", {
										onClose: function () {
											that.refreshModelAndView();
										}
									});
								}
							}
						}
					});
				}
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
				var fileName = oItem.getFileName();
				var downloadUrl = `http://localhost:5500/download/${encodeURIComponent(fileName)}`;
		
				$.ajax({
					url: downloadUrl,
					method: "GET",
					xhrFields: {
						responseType: 'blob'
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
							sap.m.MessageBox.error(fileName + " was not found. Please reload the page and try again", {
								onClose: function() {
									// placeholder
								}
							});
						}
					}
				});
			});
		},
		onDeleteSelectedButton: function () {
		
			var oUploadSet = this.byId("UploadSet");
			var accessToken = sessionStorage.getItem("accessToken");
			var employeeId = sessionStorage.getItem("employeeId");
			let deletePromises = [];

			oUploadSet.getSelectedItems().forEach((oItem) => {
				var fileName = oItem.getFileName();
				var deleteUrl = "http://localhost:5500/deletefile";

				let deletePromise = new Promise((resolve, reject) => {
					$.ajax({
						url: deleteUrl,
						method: "DELETE",
						contentType: 'application/json',
						headers: {
							'Authorization': 'Bearer ' + accessToken
						},
						data: JSON.stringify({
							fileName: fileName,
							employeeId: employeeId
						}),
						success: () => resolve(fileName),
						error: (xhr) => reject({ xhr: xhr, fileName: fileName })
					});
				});

				deletePromises.push(deletePromise);
			});

			Promise.allSettled(deletePromises).then((results) => {
				let deletedFiles = results.filter(result => result.status === 'fulfilled').map(result => result.value);
				let errors = results.filter(result => result.status === 'rejected').map(result => result.reason);

				if (deletedFiles.length > 0) {
					sap.m.MessageBox.success(deletedFiles.length + " file(s) were deleted.", {
						onClose: () => {
							this.refreshModelAndView();
						}
					});
				}

				if (errors.length > 0) {
					let firstError = errors[0];
					let errorMessage = firstError.xhr.responseJSON && firstError.xhr.responseJSON.message 
									? firstError.xhr.responseJSON.message 
									: "An error occurred while deleting " + firstError.fileName + ". Please try again.";
					sap.m.MessageBox.error(errorMessage);
				}
			});
		},
		onSelectionChange: function() {

			var oUploadSet = this.byId("UploadSet");
			var oUploadBtn = this.byId("uploadSelectedButton");
			var oDownloadBtn = this.byId("downloadSelectedButton");
			var oDeleteBtn = this.byId("deleteSelectedButton");

			if (oUploadSet.getSelectedItems().length > 0) {
				oUploadBtn.setEnabled(true);
				oDownloadBtn.setEnabled(true);
				oDeleteBtn.setEnabled(true);
			} else {
				oUploadBtn.setEnabled(false);
				oDownloadBtn.setEnabled(false);	
				oDeleteBtn.setEnabled(false);
			}
		},
		onFileRenamed: function(oEvent) {
			var oParameters = oEvent.getParameters();
			var oRenamedItem = oParameters.item;
			var sNewFileName = oRenamedItem.getFileName();
			this.renamedFiles[oRenamedItem.getFileObject().name] = sNewFileName;
		},
		onUploadCompleted: function(oEvent) {
			this.oItemToUpdate = null;
		},
		onLogout: function () {
			sessionStorage.removeItem("accessToken");
			this.getOwnerComponent().getRouter().navTo("login");
		},
		onMediaTypeMismatch: function(oEvent) {
			var sFileName = oEvent.getParameter("item").getFileName();
			sap.m.MessageBox.warning("The file '" + sFileName + "' is not of an allowed type. Please upload only the supported file types.");
		},
		convertDateFormat: function (dateString) {
			var date = new Date(dateString);
			return date.toISOString().split('T')[0]; 
		}
	});
});