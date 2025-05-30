const db = require('../../../utils/db');
const app = getApp();
const fs = wx.getFileSystemManager(); // Ensure fs is available globally in the Page scope

Page({
  data: {
    hotelId: null, // This will store the cloud FileID of the hotel JSON
    currentHotel: null, // This will store the parsed content of the hotel JSON
    hotelName: '房型管理',
    roomTypes: [], // Will store ALL room types for the current hotel
    displayedRoomTypes: [], // For displaying filtered results
    searchQuery: '', // For search functionality
    showModal: false,
    isEditingRoomType: false,
    currentRoomType: { // For modal binding
      id: null,
      type: '',        // 房型名称
      roomNumber: '',  // 房间号码
      price: null,
      floor: '',
      status: '空闲', // Default status
      amenities: [],
      amenitiesString: '', // For textarea binding
      hotelId: '', // 确保 hotelId 也有初始值
      roomTypeVideoFileID: null, // Changed: from roomTypeImageFileID
    },
    statusBarHeight: app.globalData.statusBarHeight || wx.getSystemInfoSync().statusBarHeight,
    isUploadingVideo: false, // Changed: from isUploadingImage
  },

  // Helper function to extract relative path from cloud FileID
  getRelativeCloudPath: function(fileID) {
    if (!fileID || !fileID.startsWith('cloud://')) {
      console.error('[getRelativeCloudPath] Invalid or non-cloud fileID provided:', fileID);
      return null; 
    }
    // Example: cloud://env-id.region-xxxx/actual/path/file.json
    // We want "actual/path/file.json"
    const parts = fileID.split('/');
    if (parts.length < 4) { // Expected: cloud:,,env-id,actual/path...
      console.error('[getRelativeCloudPath] Cannot extract relative path from fileID, structure unexpected:', fileID);
      return null;
    }
    return parts.slice(3).join('/');
  },

  onLoad: async function (options) { 
    console.log('[ManageRoomTypes] onLoad started. Options:', options);
    if (options.hotelId) {
      const hotelFileCloudPath = decodeURIComponent(options.hotelId);
      const hotelNameFromParams = options.hotelName ? decodeURIComponent(options.hotelName) : '房型管理';

      try {
        wx.showLoading({ title: '加载酒店数据...' });
        
        console.log('[ManageRoomTypes] Attempting to download hotel JSON:', hotelFileCloudPath);
        const downloadRes = await wx.cloud.downloadFile({
          fileID: hotelFileCloudPath
        });
        console.log('[ManageRoomTypes] Hotel JSON downloaded to temp path:', downloadRes.tempFilePath);

        const fileContent = fs.readFileSync(downloadRes.tempFilePath, 'utf-8');
        const hotelDetails = JSON.parse(fileContent);
        console.log('[ManageRoomTypes] Parsed hotelDetails:', hotelDetails);

        if (hotelDetails) {
          // IMPORTANT Assumption: The hotelDetails JSON must contain an 'id' field 
          // that db.js uses internally to link rooms (e.g., hotelDetails.id)
          // If not, loadRoomTypes will fail to find rooms.
          if (!hotelDetails.id) {
            console.warn('[ManageRoomTypes] The loaded hotelDetails JSON does not have an .id property. Rooms might not load correctly if db.js relies on it.');
            // You might need to assign a relevant ID here, or fetch it differently if your db.js uses a different key.
          }

          this.setData({
            hotelId: hotelFileCloudPath, 
            currentHotel: hotelDetails,  
            hotelName: hotelDetails.name || hotelNameFromParams
          });

          wx.setNavigationBarTitle({ title: `${this.data.hotelName} - 房型管理` });
          this.loadRoomTypes(); 
          wx.hideLoading();
        } else {
          wx.hideLoading();
          console.error('[ManageRoomTypes] Failed to parse hotel details from downloaded JSON.');
          wx.showToast({
            title: '加载酒店数据失败',
            icon: 'error',
            duration: 2000,
            complete: () => wx.navigateBack()
          });
        }
      } catch (err) {
        wx.hideLoading();
        console.error('[ManageRoomTypes] Error loading hotel details in onLoad:', err);
        wx.showToast({
          title: '加载酒店信息出错',
          icon: 'error',
          duration: 2000,
          complete: () => wx.navigateBack()
        });
      }
    } else {
      console.error('[ManageRoomTypes] Missing hotelId in options.');
      wx.showToast({
        title: '缺少酒店信息',
        icon: 'error',
        duration: 2000,
        complete: () => wx.navigateBack()
      });
    }
    console.log('[ManageRoomTypes] onLoad finished.');
  },

  loadRoomTypes: function () {
    if (!this.data.currentHotel) { 
        console.warn("[ManageRoomTypes] loadRoomTypes: currentHotel is not set. Cannot load rooms.");
        this.setData({ roomTypes: [] });
        return;
    }
    // Rooms are now part of the currentHotel object loaded from the JSON file
    const rooms = this.data.currentHotel.roomTypes || []; // Initialize with empty array if undefined
    console.log(`[ManageRoomTypes] loadRoomTypes: Loading rooms from currentHotel.roomTypes. Found ${rooms.length} rooms initially.`);
    
    this.setData({
      roomTypes: rooms.map(room => ({
        ...room,
        // Ensure amenitiesString is correctly formatted for display if needed
        amenitiesString: Array.isArray(room.amenities) ? room.amenities.join(', ') : (room.amenities || ''),
        roomTypeVideoFileID: room.roomTypeVideoFileID || null
      }))
    });
    this.updateDisplayedRoomTypes(); // Apply search filter after loading
    console.log(`[ManageRoomTypes] loadRoomTypes: Processed rooms for display. Initial count for display: ${this.data.displayedRoomTypes.length}`);
  },

  handleSearchInput: function(e) {
    const searchQuery = e.detail.value;
    this.setData({ searchQuery: searchQuery });
    if (!searchQuery) { // If search query is cleared, update display immediately
        this.updateDisplayedRoomTypes(); 
    }
  },

  handleSearchConfirm: function() {
    this.updateDisplayedRoomTypes();
  },

  clearSearchQuery: function() {
    this.setData({ searchQuery: '' });
    this.updateDisplayedRoomTypes();
  },

  updateDisplayedRoomTypes: function() {
    const allRoomTypes = this.data.roomTypes; // Use the master list
    const query = this.data.searchQuery.toLowerCase().trim();

    if (!query) {
      this.setData({ displayedRoomTypes: allRoomTypes });
      return;
    }

    const filtered = allRoomTypes.filter(roomType => {
      const nameMatch = roomType.type && roomType.type.toLowerCase().includes(query);
      const roomNumberMatch = roomType.roomNumber && roomType.roomNumber.toLowerCase().includes(query);
      return nameMatch || roomNumberMatch;
    });
    this.setData({ displayedRoomTypes: filtered });
  },

  navigateBack: function() {
    wx.navigateBack();
  },

  showAddRoomTypeModal: function () {
    if (!this.data.currentHotel || !this.data.currentHotel.id) {
      wx.showToast({ title: '酒店信息加载失败', icon: 'none'});
      return;
    }
    this.setData({
      showModal: true,
      isEditingRoomType: false,
      currentRoomType: {
        id: null, type: '', roomNumber: '', price: null, floor: '', 
        status: '空闲', amenities: [], amenitiesString: '', 
        hotelId: this.data.currentHotel.id,
        roomTypeVideoFileID: null, // Changed: from roomTypeImageFileID
      },
      isUploadingVideo: false // Changed: from isUploadingImage
    });
  },

  showEditRoomTypeModal: function(e) {
    const roomId = e.currentTarget.dataset.roomid;
    const roomToEdit = this.data.roomTypes.find(room => room.id === roomId);

    if (roomToEdit) {
      // Create a deep copy to avoid direct mutation of the list item
      const currentRoomData = JSON.parse(JSON.stringify(roomToEdit));
      
      // Ensure amenitiesString is correctly populated for the modal
      if (Array.isArray(currentRoomData.amenities)) {
        currentRoomData.amenitiesString = currentRoomData.amenities.join(', ');
      } else {
        currentRoomData.amenitiesString = ''; // Default to empty string if amenities is not an array
      }

      currentRoomData.roomTypeVideoFileID = currentRoomData.roomTypeVideoFileID || null; // Ensure this field exists

      this.setData({
        showModal: true,
        isEditingRoomType: true,
        currentRoomType: currentRoomData,
        isUploadingVideo: false // Changed: from isUploadingImage
      });
    } else {
      wx.showToast({
        title: '未找到房型数据',
        icon: 'none'
      });
    }
  },

  hideModal: function () {
    this.setData({ showModal: false });
  },

  handleModalInputChange: function(e) {
    const field = e.currentTarget.dataset.field;
    const value = e.detail.value;
    const updatePath = `currentRoomType.${field}`;
    
    this.setData({
      [updatePath]: value
    });

    console.log(`--- Input Event Triggered ---`);
    console.log(`Field: '${field}', Value: '${value}'`);
    console.log('Updated this.data.currentRoomType:', JSON.stringify(this.data.currentRoomType));
    console.log(`-----------------------------`);
  },

  uploadRoomTypeVideo: function() { // Renamed: from uploadRoomTypeImage
    const that = this;
    if (that.data.isUploadingVideo) return; // Changed: from isUploadingImage
    // Ensure hotelId is present (it's part of currentRoomType or page data)
    const hotelId = that.data.currentRoomType.hotelId || that.data.hotelId; 
    if (!hotelId) {
      wx.showToast({ title: '酒店ID丢失,无法上传', icon: 'none' });
      return;
    }

    wx.chooseMedia({
      mediaType: ['video'], // Changed: from ['image']
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      maxDuration: 60, 
      success(res) {
        if (res.tempFiles && res.tempFiles.length > 0) {
          that.setData({ isUploadingVideo: true }); // Changed: from isUploadingImage
          const tempFilePath = res.tempFiles[0].tempFilePath;
          
          const roomTypeName = that.data.currentRoomType.type.replace(/\s+/g, '_') || 'room_type_video';
          const timestamp = Date.now();
          let fileExtension = '.mp4';
          const tempFileName = res.tempFiles[0].tempFilePath;
          const match = tempFileName.match(/\.[^.]+?$/);
          if (match) fileExtension = match[0];
          
          const cloudPath = `room_type_videos/${hotelId}/${roomTypeName}_${timestamp}${fileExtension}`; // Changed folder and uses hotel's internal ID for path

          wx.cloud.uploadFile({
            cloudPath: cloudPath,
            filePath: tempFilePath,
            success: uploadResult => {
              const newFileID = uploadResult.fileID;
              const oldFileID = that.data.currentRoomType.roomTypeVideoFileID; // Changed: from roomTypeImageFileID

              console.log('房型视频上传成功 File ID:', newFileID);
              that.setData({
                'currentRoomType.roomTypeVideoFileID': newFileID,
                isUploadingVideo: false // Changed: from isUploadingImage
              });
              wx.showToast({ title: '视频上传成功!', icon: 'success', duration: 1500 });

              if (oldFileID && oldFileID !== newFileID) {
                console.log('尝试删除旧的房型视频:', oldFileID);
                wx.cloud.deleteFile({
                  fileList: [oldFileID],
                  success: deleteRes => {
                    console.log('旧的房型视频删除成功:', oldFileID, deleteRes.fileList);
                  },
                  fail: deleteErr => {
                    console.error('旧的房型视频删除失败:', oldFileID, deleteErr);
                    // Log to local storage for manual cleanup
                    let failedDeletions = wx.getStorageSync('failed_video_deletions') || [];
                    failedDeletions.push({
                      fileID: oldFileID,
                      type: 'room_type_video',
                      parentId: that.data.currentRoomType.id || that.data.currentRoomType.roomNumber, // Use room ID or number as reference
                      hotelId: hotelId,
                      attemptedDeleteTime: new Date().toISOString(),
                      error: JSON.stringify(deleteErr) // Store error details
                    });
                    wx.setStorageSync('failed_video_deletions', failedDeletions);
                    wx.showToast({ title: '旧视频云端删除失败,已记录', icon: 'none', duration: 2000 });
                  }
                });
              }
            },
            fail: err => {
              that.setData({ isUploadingVideo: false }); // Changed: from isUploadingImage
              wx.showToast({ title: '视频上传失败,请重试', icon: 'none' });
              console.error('房型视频上传失败:', err);
            }
          });
        }
      },
      fail: () => {
        // User cancelled selection
      }
    });
  },

  removeRoomTypeVideo: function() { // Renamed: from removeRoomTypeImage
    if (this.data.isUploadingVideo) {
      wx.showToast({ title: '视频上传中...', icon: 'none'});
      return;
    }
    this.setData({
      'currentRoomType.roomTypeVideoFileID': null
    });
    wx.showToast({title: '视频已移除', icon: 'none', duration: 1000});
  },

  handleSaveRoomType: async function () { // Make function async for cloud operations
    if (!this.data.currentRoomType.type || !this.data.currentRoomType.price) {
      wx.showToast({ title: '类型和价格不能为空', icon: 'none' });
      return;
    }
    // hotelId is the cloud FileID of the hotel's JSON, stored on the page.
    const fullFileID = this.data.hotelId; // this.data.hotelId is the full cloud FileID
    if (!fullFileID) {
        wx.showToast({ title: '酒店文件路径丢失', icon: 'error' });
        console.error("[HandleSaveRoomType] this.data.hotelId (cloud FileID) is missing.");
        return;
    }
    if (!this.data.currentHotel) {
        wx.showToast({ title: '当前酒店数据丢失', icon: 'error' });
        console.error("[HandleSaveRoomType] this.data.currentHotel is missing.");
        return;
    }

    wx.showLoading({ title: '保存中...' });

    let updatedHotelData = JSON.parse(JSON.stringify(this.data.currentHotel)); // Deep copy
    if (!Array.isArray(updatedHotelData.roomTypes)) {
        updatedHotelData.roomTypes = []; // Ensure roomTypes array exists
    }

    const roomDataFromForm = {
      ...this.data.currentRoomType,
      price: parseFloat(this.data.currentRoomType.price) || 0,
      amenities: typeof this.data.currentRoomType.amenitiesString === 'string' ? 
                   this.data.currentRoomType.amenitiesString.split(',').map(a => a.trim()).filter(a => a) : 
                   (Array.isArray(this.data.currentRoomType.amenities) ? this.data.currentRoomType.amenities : []),
    };
    delete roomDataFromForm.amenitiesString; // Clean up temporary field
    // hotelId within roomDataFromForm is not the cloud FileID, but the internal hotel.id if it exists.
    // We are saving the entire hotel object, so this specific hotelId in room object becomes less critical for this save operation.
    // However, ensure it's consistent if other parts of your app use room.hotelId for filtering within a loaded hotel object.
    // For linking, the room is part of updatedHotelData.roomTypes which is saved under the hotel's main cloud FileID.
    if (this.data.currentHotel.id) { // If the hotel itself has an internal ID from its JSON
        roomDataFromForm.hotelId = this.data.currentHotel.id;
    }

    let success = false;
    if (this.data.isEditingRoomType && roomDataFromForm.id) {
      // Update existing room type
      const roomIndex = updatedHotelData.roomTypes.findIndex(r => r.id === roomDataFromForm.id);
      if (roomIndex > -1) {
        updatedHotelData.roomTypes[roomIndex] = roomDataFromForm;
        success = true;
        console.log('[HandleSaveRoomType] Updating existing room:', roomDataFromForm);
      } else {
        console.error('[HandleSaveRoomType] Failed to find room to update with id:', roomDataFromForm.id);
        success = false;
      }
    } else {
      // Add new room type
      roomDataFromForm.id = `roomtype_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`; // Generate a unique ID
      updatedHotelData.roomTypes.push(roomDataFromForm);
      success = true;
      console.log('[HandleSaveRoomType] Adding new room:', roomDataFromForm);
    }

    if (success) {
      try {
        const hotelJsonString = JSON.stringify(updatedHotelData, null, 2);
        const tempFilePath = `${wx.env.USER_DATA_PATH}/temp_hotel_with_rooms_${Date.now()}.json`;
        fs.writeFileSync(tempFilePath, hotelJsonString, 'utf8');

        const relativeCloudPath = this.getRelativeCloudPath(fullFileID);
        if (!relativeCloudPath) {
          wx.hideLoading();
          wx.showToast({ title: '保存路径错误', icon: 'error' });
          console.error("[HandleSaveRoomType] Could not derive relative cloud path from FileID:", fullFileID);
          return;
        }

        console.log('[HandleSaveRoomType] Attempting to upload updated hotel JSON to relative path:', relativeCloudPath);
        await wx.cloud.uploadFile({
          cloudPath: relativeCloudPath, // Use the derived relative path
          filePath: tempFilePath,
        });
        
        fs.unlink({ filePath: tempFilePath, fail: (err) => console.warn('Failed to delete temp hotel JSON:', err) });
        console.log('[HandleSaveRoomType] Hotel data with updated room types saved to cloud.');
        
        // Update local currentHotel data to reflect changes immediately
        this.setData({ 
            currentHotel: updatedHotelData,
            showModal: false, // Corrected: hide modal on success
        });
        this.loadRoomTypes(); // Refresh list (which will call updateDisplayedRoomTypes)
        wx.hideLoading();
        wx.setStorageSync('hotel_data_dirty', true);
        console.log('[ManageRoomTypes] Set hotel_data_dirty flag to true after saving room type.');
        wx.showToast({ title: this.data.isEditingRoomType ? '修改成功' : '添加成功', icon: 'success' });

      } catch (cloudError) {
        wx.hideLoading();
        success = false;
        console.error('[HandleSaveRoomType] Failed to save hotel data to cloud:', cloudError);
        wx.showToast({ title: '保存到云端失败', icon: 'error', duration: 2500 });
      }
    } else {
      wx.hideLoading();
      // Error message for failure before cloud operation (e.g., room not found for update)
      wx.showToast({ title: this.data.isEditingRoomType ? '修改查找失败' : '添加准备失败', icon: 'error' });
    }
  },

  confirmDeleteRoomType: async function (e) { // Make async
    const roomId = e.currentTarget.dataset.roomid;
    // const roomType = e.currentTarget.dataset.roomtype; // Not strictly needed for deletion logic if using ID
    const fullFileID = this.data.hotelId;

    if (!fullFileID) {
        wx.showToast({ title: '酒店文件路径丢失', icon: 'error' });
        console.error("[ConfirmDeleteRoomType] this.data.hotelId (cloud FileID) is missing.");
        return;
    }
    if (!this.data.currentHotel || !Array.isArray(this.data.currentHotel.roomTypes)) {
        wx.showToast({ title: '当前酒店或房型数据错误', icon: 'error' });
        console.error("[ConfirmDeleteRoomType] currentHotel or currentHotel.roomTypes is invalid.");
        return;
    }

    const roomToDelete = this.data.currentHotel.roomTypes.find(r => r.id === roomId);
    const roomTypeNameForModal = roomToDelete ? roomToDelete.type : '该房型';

    wx.showModal({
      title: '确认删除',
      content: `确定要删除房型 "${roomTypeNameForModal}" 吗？此操作不可撤销。`,
      confirmColor: "#ee0a24",
      success: async (res) => { // Make inner success async
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' });
          let updatedHotelData = JSON.parse(JSON.stringify(this.data.currentHotel));
          const initialRoomCount = updatedHotelData.roomTypes.length;
          updatedHotelData.roomTypes = updatedHotelData.roomTypes.filter(room => room.id !== roomId);
          
          if (updatedHotelData.roomTypes.length === initialRoomCount) {
            wx.hideLoading();
            console.warn('[ConfirmDeleteRoomType] Room with ID not found for deletion:', roomId);
            wx.showToast({ title: '未找到要删除的房型', icon: 'none' });
            return;
          }

          try {
            // Also attempt to delete associated room type video if it exists
            if (roomToDelete && roomToDelete.roomTypeVideoFileID) {
              console.log('[ConfirmDeleteRoomType] Attempting to delete room video:', roomToDelete.roomTypeVideoFileID);
              try {
                await wx.cloud.deleteFile({ fileList: [roomToDelete.roomTypeVideoFileID] });
                console.log('[ConfirmDeleteRoomType] Room video deleted successfully.');
              } catch (vidErr) {
                console.error('[ConfirmDeleteRoomType] Failed to delete room video, logging error:', vidErr);
                // Log to local storage for manual cleanup (similar to other video deletion logic)
                let failedDeletions = wx.getStorageSync('failed_video_deletions') || [];
                failedDeletions.push({
                  fileID: roomToDelete.roomTypeVideoFileID,
                  type: 'room_type_video_on_room_delete',
                  parentId: roomId, 
                  hotelId: this.data.hotelId, // Hotel JSON FileID
                  attemptedDeleteTime: new Date().toISOString(),
                  error: JSON.stringify(vidErr)
                });
                wx.setStorageSync('failed_video_deletions', failedDeletions);
                wx.showToast({ title: '房型视频云端删除失败,已记录', icon: 'none' });
              }
            }
            
            const hotelJsonString = JSON.stringify(updatedHotelData, null, 2);
            const tempFilePath = `${wx.env.USER_DATA_PATH}/temp_hotel_delete_room_${Date.now()}.json`;
            fs.writeFileSync(tempFilePath, hotelJsonString, 'utf8');

            const relativeCloudPath = this.getRelativeCloudPath(fullFileID);
            if (!relativeCloudPath) {
              wx.hideLoading();
              wx.showToast({ title: '删除路径错误', icon: 'error' });
              console.error("[ConfirmDeleteRoomType] Could not derive relative cloud path from FileID:", fullFileID);
              return;
            }

            console.log('[ConfirmDeleteRoomType] Attempting to upload updated hotel JSON to relative path:', relativeCloudPath);
            await wx.cloud.uploadFile({
              cloudPath: relativeCloudPath, // Use the derived relative path
              filePath: tempFilePath,
            });
            fs.unlink({ filePath: tempFilePath, fail: (err) => console.warn('Failed to delete temp hotel JSON for room deletion:', err) });
            console.log('[ConfirmDeleteRoomType] Hotel data with deleted room type saved to cloud.');

            this.setData({ currentHotel: updatedHotelData });
            this.loadRoomTypes(); // Refresh list (which will call updateDisplayedRoomTypes)
            wx.hideLoading();
            wx.setStorageSync('hotel_data_dirty', true);
            console.log('[ManageRoomTypes] Set hotel_data_dirty flag to true after deleting room type.');
            wx.showToast({ title: '房型已删除', icon: 'success' });

          } catch (cloudError) {
            wx.hideLoading();
            console.error('[ConfirmDeleteRoomType] Failed to save updated hotel data to cloud:', cloudError);
            wx.showToast({ title: '删除失败,云端保存错误', icon: 'error' });
          }
        }
      }
    });
  },
}); 