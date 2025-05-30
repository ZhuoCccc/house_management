// pages/admin/hotel_status_selection/hotel_status_selection.js
const fs = wx.getFileSystemManager();

// Cloud Storage Constants
const MANIFEST_FILE_CLOUD_PATH = 'cloud://cloud1-0gmfc74geebd1b50.636c-cloud1-0gmfc74geebd1b50-1360583575/hotel_data_json/manifest.json';
const HOTEL_DATA_BASE_CLOUD_PATH = 'cloud://cloud1-0gmfc74geebd1b50.636c-cloud1-0gmfc74geebd1b50-1360583575/hotel_data_json/';

Page({
  data: {
    hotels: [], // Will store hotels with their rooms array
    isLoading: false,
    errorLoading: null,
    availableStatuses: ["空闲", "入住", "打扫", "维修"],
  },

  onLoad: function (options) {
    this.loadHotelsAndIndividualRooms();
  },

  onShow: function() {
    // Reload if marked dirty by other admin operations that might affect room data or hotel list
    if (wx.getStorageSync('hotel_data_dirty')) { // Using a general dirty flag
        console.log('[RoomStatusMgmt] Hotel data is dirty, reloading.');
        wx.removeStorageSync('hotel_data_dirty');
        this.loadHotelsAndIndividualRooms();
    } else if (this.data.errorLoading && !this.data.isLoading) {
        this.loadHotelsAndIndividualRooms(); // Retry if previous load failed
    }
  },

  // Helper function to extract relative path from cloud FileID
  getRelativeCloudPath: function(fileID) {
    if (!fileID || !fileID.startsWith('cloud://')) {
      console.error('[getRelativeCloudPath] Invalid or non-cloud fileID provided:', fileID);
      return null; 
    }
    const parts = fileID.split('/');
    if (parts.length < 4) { 
      console.error('[getRelativeCloudPath] Cannot extract relative path from fileID, structure unexpected:', fileID);
      return null;
    }
    return parts.slice(3).join('/');
  },

  async loadHotelsAndIndividualRooms() {
    this.setData({ isLoading: true, hotels: [], errorLoading: null });
    wx.showLoading({ title: '加载酒店及房态...', mask: true });

    let hotelJsonFileNamesFromManifest = [];
    try {
      const manifestDownloadRes = await wx.cloud.downloadFile({ fileID: MANIFEST_FILE_CLOUD_PATH });
      const manifestContent = fs.readFileSync(manifestDownloadRes.tempFilePath, 'utf-8');
      hotelJsonFileNamesFromManifest = JSON.parse(manifestContent);
    } catch (err) {
      console.error('[RoomStatusMgmt] Loading manifest.json failed:', err);
      this.setData({ isLoading: false, errorLoading: '加载酒店列表失败' });
      wx.hideLoading();
      wx.showToast({ title: '列表加载失败', icon: 'none' });
      return;
    }

    if (!hotelJsonFileNamesFromManifest || hotelJsonFileNamesFromManifest.length === 0) {
        this.setData({ isLoading: false, hotels: [], errorLoading: '没有找到酒店数据' });
        wx.hideLoading();
        return;
    }

    const loadedHotels = [];
    for (const fileName of hotelJsonFileNamesFromManifest) {
      if (!fileName || typeof fileName !== 'string') {
        console.warn('[RoomStatusMgmt] Invalid filename in manifest:', fileName);
        continue;
      }
      const fullFilePath = `${HOTEL_DATA_BASE_CLOUD_PATH}${fileName}`;
      try {
        const downloadRes = await wx.cloud.downloadFile({ fileID: fullFilePath });
        const fileContent = fs.readFileSync(downloadRes.tempFilePath, 'utf-8');
        let hotelData = JSON.parse(fileContent);
        
        // Prepare hotel object for display
        const displayHotel = {
            id: hotelData.id || fileName.split('.')[0], 
            name: hotelData.name || fileName.split('.')[0], 
            fileName: fileName,
            jsonFileCloudID: fullFilePath,
            description: hotelData.description || '',
            location: hotelData.location || '',
            cityName: hotelData.cityName || '',
            hotelImageFileID: hotelData.hotelImageFileID || '',
            // Preserve the original roomTypes array from the JSON for saving later.
            roomTypes: hotelData.roomTypes && Array.isArray(hotelData.roomTypes) ? hotelData.roomTypes : [],
            
            // Create the 'rooms' array for UI display, derived from 'roomTypes'.
            // This 'rooms' array will only contain actual room instances suitable for status management.
            rooms: (hotelData.roomTypes && Array.isArray(hotelData.roomTypes)) ?
                   hotelData.roomTypes
                     .filter(rt => rt.hasOwnProperty('roomNumber') && rt.hasOwnProperty('status')) // Filter for actual room instances
                     .map(roomInstance => ({ // 'roomInstance' is an item from roomTypes that represents a room
                        id: roomInstance.id, // Use the id from the roomType object (which is the room's unique ID)
                        roomNumber: roomInstance.roomNumber || '未知房号',
                        status: roomInstance.status || '空闲',
                        // Spread other properties from roomInstance in case they are needed by UI or logic
                        ...roomInstance 
                     })) : [] 
        };
        loadedHotels.push(displayHotel);
      } catch (err) {
        console.error(`[RoomStatusMgmt] Failed to load or parse hotel JSON (${fileName}):`, err);
      }
    }

    this.setData({
      hotels: loadedHotels,
      isLoading: false,
      errorLoading: loadedHotels.length === 0 && hotelJsonFileNamesFromManifest.length > 0 ? '未能加载任何酒店房态' : null
    });
    wx.hideLoading();
    console.log('[RoomStatusMgmt] Finished loading hotels and rooms. Hotel count:', loadedHotels.length);
  },

  handleChangeRoomStatus: function(event) {
    const { hotelIndex, roomIndex } = event.currentTarget.dataset;
    const currentStatus = this.data.hotels[hotelIndex].rooms[roomIndex].status;
    const hotelName = this.data.hotels[hotelIndex].name;
    const roomNumber = this.data.hotels[hotelIndex].rooms[roomIndex].roomNumber;

    wx.showActionSheet({
      itemList: this.data.availableStatuses,
      success: async (res) => {
        const selectedStatus = this.data.availableStatuses[res.tapIndex];
        if (selectedStatus && selectedStatus !== currentStatus) {
          console.log(`[RoomStatusMgmt] User selected new status '${selectedStatus}' for ${hotelName} - Room ${roomNumber}`);
          
          // Optimistic UI Update on the 'rooms' array (UI representation)
          this.setData({ [`hotels[${hotelIndex}].rooms[${roomIndex}].status`]: selectedStatus });

          // Prepare the hotel object for saving.
          // hotelToSave is a deep copy of the full hotel object from this.data.hotels
          const hotelToSave = JSON.parse(JSON.stringify(this.data.hotels[hotelIndex]));
          
          // hotelToSave.rooms[roomIndex].status is now the new status.
          // Find the corresponding room in hotelToSave.roomTypes (the original structure) and update its status.
          const uiRoomThatChanged = hotelToSave.rooms[roomIndex];
          const originalRoomTypeToUpdate = hotelToSave.roomTypes.find(rt => rt.id === uiRoomThatChanged.id);

          if (originalRoomTypeToUpdate) {
            originalRoomTypeToUpdate.status = selectedStatus; // Update status in the array that will be saved
          } else {
            console.error("[RoomStatusMgmt] Could not find the room in original roomTypes to update status. This should not happen.");
            wx.showToast({ title: '内部错误，保存失败', icon: 'none' });
            // Revert optimistic UI update
            this.setData({ [`hotels[${hotelIndex}].rooms[${roomIndex}].status`]: currentStatus });
            return;
          }

          try {
            wx.showLoading({ title: '保存状态中...'});
            // Pass the hotelToSave object, which now has the updated 'roomTypes' array (among other original data)
            await this.saveHotelDataToCloud(hotelToSave); 
            wx.hideLoading();
            wx.showToast({ title: '状态更新成功', icon: 'success' });
            wx.setStorageSync('hotel_data_dirty', true); // Notify other pages of change
          } catch (err) {
            wx.hideLoading();
            wx.showToast({ title: '状态保存失败', icon: 'none' });
            console.error('[RoomStatusMgmt] Failed to save room status change:', err);
            // Revert optimistic update on failure
            this.setData({ [`hotels[${hotelIndex}].rooms[${roomIndex}].status`]: currentStatus });
          }
        }
      },
      fail: (res) => {
        console.log('[RoomStatusMgmt] User cancelled status selection or action sheet failed:', res.errMsg);
      }
    });
  },

  async saveHotelDataToCloud(hotelObjectWithUpdatedData) {
    if (!hotelObjectWithUpdatedData || !hotelObjectWithUpdatedData.jsonFileCloudID || !hotelObjectWithUpdatedData.fileName) {
      console.error('[RoomStatusMgmt] Invalid hotel object for saving.');
      throw new Error('酒店数据不完整，无法保存。');
    }

    // Construct the object to be persisted in the JSON file.
    // It should mirror the original JSON structure, using the updated hotelObjectWithUpdatedData.roomTypes.
    const hotelDataForJson = {
      id: hotelObjectWithUpdatedData.id,
      name: hotelObjectWithUpdatedData.name,
      description: hotelObjectWithUpdatedData.description,
      location: hotelObjectWithUpdatedData.location,
      cityName: hotelObjectWithUpdatedData.cityName,
      hotelImageFileID: hotelObjectWithUpdatedData.hotelImageFileID,
      roomTypes: hotelObjectWithUpdatedData.roomTypes.map(rt => {
        // Create a clean representation for storage, preserving all intended fields.
        // This assumes rt objects don't have temporary UI-only sub-properties.
        // A simple spread effectively shallow copies all enumerable properties of rt.
        const { ...persistentRoomType } = rt; 
        return persistentRoomType;
      }),
      // Add any other top-level properties from the original hotel JSON that are stored on hotelObjectWithUpdatedData
      // For example:
      // if (hotelObjectWithUpdatedData.hasOwnProperty('someOtherProperty')) {
      //   hotelDataForJson.someOtherProperty = hotelObjectWithUpdatedData.someOtherProperty;
      // }
    };
    
    // The 'rooms' property on hotelObjectWithUpdatedData was for UI display and filtering, 
    // it's not part of the persisted hotel JSON structure directly (which uses roomTypes).

    const jsonData = JSON.stringify(hotelDataForJson, null, 2);
    const tempFilePath = `${wx.env.USER_DATA_PATH}/temp_room_status_${hotelObjectWithUpdatedData.fileName}`;
    let tempFileWritten = false;

    try {
      fs.writeFileSync(tempFilePath, jsonData, 'utf8');
      tempFileWritten = true;
      
      const relativeCloudPath = this.getRelativeCloudPath(hotelObjectWithUpdatedData.jsonFileCloudID);
      if (!relativeCloudPath) {
          throw new Error('无法生成云端保存路径。');
      }

      await wx.cloud.uploadFile({
        cloudPath: relativeCloudPath,
        filePath: tempFilePath,
      });
      console.log(`[RoomStatusMgmt] Successfully uploaded updated hotel JSON ${hotelObjectWithUpdatedData.fileName} to ${relativeCloudPath}`);
      // wx.setStorageSync('hotel_data_dirty', true); // Moved to handleChangeRoomStatus success path

    } catch (err) {
      console.error('[RoomStatusMgmt] Error during file write or upload for room status update:', err);
      throw err; // Re-throw to be caught by handleChangeRoomStatus
    } finally {
      if (tempFileWritten) {
        try { fs.unlinkSync(tempFilePath); } 
        catch (unlinkErr) { console.warn('[RoomStatusMgmt] Failed to unlink temp room status file:', unlinkErr); }
      }
    }
  },

  onPullDownRefresh: function () {
    console.log('[RoomStatusMgmt] Pull down refresh triggered.');
    wx.showNavigationBarLoading();
    this.loadHotelsAndIndividualRooms()
      .then(() => {
        wx.hideNavigationBarLoading();
        wx.stopPullDownRefresh();
        wx.showToast({ title: '房态已刷新', icon: 'success', duration: 1000 });
      })
      .catch(() => {
        wx.hideNavigationBarLoading();
        wx.stopPullDownRefresh();
        wx.showToast({ title: '刷新失败', icon: 'none', duration: 1000 });
      });
  }
}); 