const fs = wx.getFileSystemManager(); // Add fs
// const db = require('../../utils/db.js'); // Remove old db import
const locationData = require('../../utils/province_city_data.js');

// Cloud Storage Constants (ensure these are consistent with hotel_management.js and correct for your env)
const MANIFEST_FILE_CLOUD_PATH = 'cloud://cloud1-0gmfc74geebd1b50.636c-cloud1-0gmfc74geebd1b50-1360583575/hotel_data_json/manifest.json';
const HOTEL_DATA_BASE_CLOUD_PATH = 'cloud://cloud1-0gmfc74geebd1b50.636c-cloud1-0gmfc74geebd1b50-1360583575/hotel_data_json/'; // Base path for hotel JSON files
const DEFAULT_HOTEL_IMAGE_CLOUD_FILE_ID = 'cloud://替换为你的真实默认图片云存储文件ID'; // <<< --- IMPORTANT: 确保这里是你自己上传的默认图片的真实云存储FileID

const getBeijingDateInfo = (date) => {
  if (!date || typeof date.getFullYear !== 'function') {
    console.warn('getBeijingDateInfo received invalid date:', date);
    // Return a structure that won't break bindings, or handle more gracefully
    return { dateString: '无效日期', dayOfWeek: '', year: '', month: '', day: '' };
  }
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const dayOfWeek = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][date.getDay()];
  return {
    dateString: `${month}月${day}日`,
    dayOfWeek: dayOfWeek,
    year: year,
    month: parseInt(month),
    day: parseInt(day)
  };
};

// Helper function to format date to YYYY-MM-DD for picker
const formatDateForPicker = (date) => {
  if (!date || typeof date.getFullYear !== 'function') {
    console.warn('formatDateForPicker received invalid date:', date);
    return new Date().toISOString().split('T')[0]; // Fallback to today's date string
  }
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

Page({
  data: {
    backgroundImageUrl: '/static/images/hotel_room_banner.jpg',
    checkIn: null,
    checkOut: null,
    numberOfNights: 1,
    pickerMinDate: '',
    brandName: '腾冲旅居',
    hotels: [],
    displayedHotels: [],
    isLoadingHotels: false,
    allProvinceCityData: locationData.fullProvinceCityData,
    provinces: [],
    cities: [],
    pickerValue: [0, 0],
    selectedProvinceCityText: '选择省市',
    showProvinceCityPicker: false,
    currentSelectedCityName: null,
    searchQuery: '' // Added for search functionality
  },

  loadHotelsFromCloud: async function () {
    console.log('[Home] loadHotelsFromCloud: Starting to load hotels from cloud storage.');
    this.setData({ isLoadingHotels: true, hotels: [], displayedHotels: [] });
    wx.showLoading({ title: '加载酒店...', mask: true });

    let hotelJsonFileNamesFromManifest = [];
    try {
      console.log('[Home] loadHotelsFromCloud: Attempting to download manifest:', MANIFEST_FILE_CLOUD_PATH);
      const manifestDownloadRes = await wx.cloud.downloadFile({
        fileID: MANIFEST_FILE_CLOUD_PATH
      });
      const manifestContent = fs.readFileSync(manifestDownloadRes.tempFilePath, 'utf-8');
      hotelJsonFileNamesFromManifest = JSON.parse(manifestContent);
      console.log('[Home] loadHotelsFromCloud: Loaded hotel filenames from manifest:', hotelJsonFileNamesFromManifest);
    } catch (err) {
      console.error('[Home] loadHotelsFromCloud: Loading manifest.json failed:', err);
      this.setData({ isLoadingHotels: false });
      wx.hideLoading();
      wx.showToast({ title: '加载酒店列表失败', icon: 'none' });
      return;
    }

    const loadedHotels = [];
    const validHotelJsonFileNames = [];
    let manifestNeedsUpdate = false;

    if (hotelJsonFileNamesFromManifest && hotelJsonFileNamesFromManifest.length > 0) {
      for (const fileName of hotelJsonFileNamesFromManifest) {
        if (!fileName || typeof fileName !== 'string') {
            console.warn('[Home] loadHotelsFromCloud: Invalid filename in manifest:', fileName);
            manifestNeedsUpdate = true;
            continue;
        }
        const fullFilePath = `${HOTEL_DATA_BASE_CLOUD_PATH}${fileName}`;
        try {
          console.log('[Home] loadHotelsFromCloud: Downloading hotel JSON:', fullFilePath);
          const downloadRes = await wx.cloud.downloadFile({ fileID: fullFilePath });
          const fileContent = fs.readFileSync(downloadRes.tempFilePath, 'utf-8');
          const hotelData = JSON.parse(fileContent);
          
          // --- BEGIN MODIFICATION: Set displayImageSrc ---
          if (hotelData.hotelImageFileID && typeof hotelData.hotelImageFileID === 'string' && hotelData.hotelImageFileID.startsWith('cloud://')) {
            hotelData.displayImageSrc = hotelData.hotelImageFileID;
            console.log(`[Home] Using specific hotel image for ${hotelData.name || fileName}: ${hotelData.hotelImageFileID}`);
          } 
          // --- END MODIFICATION ---

          // Optionally, select only necessary fields for home page display to save memory/setData cost
          // For now, loading full data.
          hotelData.fileName = fileName; // Keep fileName if needed for navigation to room_list
          hotelData.jsonFileCloudID = fullFilePath; // <<< --- ADDED: Store the JSON file's full cloud FileID
          loadedHotels.push(hotelData);
          validHotelJsonFileNames.push(fileName);
        } catch (err) {
          console.error(`[Home] loadHotelsFromCloud: Failed to load hotel JSON (${fileName}):`, err);
          manifestNeedsUpdate = true;
        }
      }
    }

    if (manifestNeedsUpdate) {
        const originalManifestContentString = JSON.stringify(hotelJsonFileNamesFromManifest.sort());
        const validManifestContentString = JSON.stringify(validHotelJsonFileNames.sort());
        if (originalManifestContentString !== validManifestContentString) {
            console.log('[Home] loadHotelsFromCloud: Manifest.json needs update. Valid count:', validHotelJsonFileNames.length);
            try {
                const updatedManifestStr = JSON.stringify(validHotelJsonFileNames, null, 2);
                const tempManifestUploadPath = `${wx.env.USER_DATA_PATH}/temp_manifest_home_repair_${Date.now()}.json`;
                fs.writeFileSync(tempManifestUploadPath, updatedManifestStr, 'utf-8');
                await wx.cloud.uploadFile({
                    cloudPath: 'hotel_data_json/manifest.json', // Relative path
                    filePath: tempManifestUploadPath
                });
                console.log('[Home] loadHotelsFromCloud: Manifest.json repaired and uploaded.');
                fs.unlinkSync(tempManifestUploadPath);
            } catch (manifestUpdateErr) {
                console.error('[Home] loadHotelsFromCloud: Failed to repair manifest.json:', manifestUpdateErr);
            }
        }
    }

    this.setData({
      hotels: loadedHotels,
      displayedHotels: this.data.currentSelectedCityName ? loadedHotels.filter(hotel => hotel.cityName === this.data.currentSelectedCityName) : loadedHotels,
      isLoadingHotels: false
    });
    this.updateDisplayedHotels(); // New: Update display based on all filters
    wx.hideLoading();
    console.log('[Home] loadHotelsFromCloud: Finished. Loaded hotels count:', loadedHotels.length);
  },

  onLoad: function(options) {
    const today = new Date();
    // const loadedHotels = db.getHotels(); // Old way, remove

    const provincesObject = this.data.allProvinceCityData['00'];
    const provincesArray = [];
    for (const key in provincesObject) {
      provincesArray.push({ key: key, name: provincesObject[key] });
    }
    // console.log("Provinces Array:", provincesArray);

    let initialCities = [];
    if (provincesArray.length > 0) {
      const firstProvinceKey = provincesArray[0].key;
      const citiesObject = this.data.allProvinceCityData[firstProvinceKey];
      if (citiesObject) {
        for (const key in citiesObject) {
          initialCities.push(citiesObject[key]);
        }
      }
    }
    // console.log("Initial Cities:", initialCities);

    this.setData({
      pickerMinDate: formatDateForPicker(today),
      // hotels: loadedHotels, // Remove old assignment
      // displayedHotels: loadedHotels, // Remove old assignment
      provinces: provincesArray,
      cities: initialCities,
    });
    this.initializeDates();
    this.loadHotelsFromCloud(); // <--- CALL NEW LOADING FUNCTION
  },

  onShow: function() {
    console.log('[Home] onShow: Checking for dirty hotel data.');
    const hotelDataDirty = wx.getStorageSync('hotel_data_dirty');
    if (hotelDataDirty) {
      console.log('[Home] onShow: Hotel data is dirty, reloading hotels from cloud.');
      this.loadHotelsFromCloud();
      wx.removeStorageSync('hotel_data_dirty'); // Clear the flag
    } else {
      // Optional: if not dirty, but hotels array is empty, maybe load then anyway?
      // This might happen if onLoad failed or was interrupted before onShow.
      if ((!this.data.hotels || this.data.hotels.length === 0) && !this.data.isLoadingHotels) {
        console.log('[Home] onShow: Hotels not loaded and not dirty, attempting to load.');
        this.loadHotelsFromCloud();
      }
    }
  },

  initializeDates: function() {
    const today = new Date();
    const checkInFullDate = new Date(today); // Keep it as a Date object
    const checkOutFullDate = new Date(today);
    checkOutFullDate.setDate(checkInFullDate.getDate() + this.data.numberOfNights);

    this.setData({
      checkIn: { ...getBeijingDateInfo(checkInFullDate), fullDate: checkInFullDate },
      checkOut: { ...getBeijingDateInfo(checkOutFullDate), fullDate: checkOutFullDate }
    });
    this.calculateNights(); // Ensure nights are calculated based on initial dates
  },
  
  calculateNights: function() {
    if (this.data.checkIn && this.data.checkIn.fullDate && this.data.checkOut && this.data.checkOut.fullDate) {
      // 确保 fullDate 是 Date 对象且有效
      if (!(this.data.checkIn.fullDate instanceof Date) || isNaN(this.data.checkIn.fullDate.getTime()) || 
          !(this.data.checkOut.fullDate instanceof Date) || isNaN(this.data.checkOut.fullDate.getTime())) {
        console.error("Invalid Date object in calculateNights", this.data.checkIn.fullDate, this.data.checkOut.fullDate);
        // 可以考虑重置日期或给出提示
        return;
      }
      const checkInTime = this.data.checkIn.fullDate.getTime();
      const checkOutTime = this.data.checkOut.fullDate.getTime();
      const diffTime = Math.abs(checkOutTime - checkInTime);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays > 0 && checkOutTime > checkInTime) { // 确保退房时间在入住之后
        this.setData({ numberOfNights: diffDays });
      } else {
        const newCheckOutFullDate = new Date(this.data.checkIn.fullDate);
        newCheckOutFullDate.setDate(this.data.checkIn.fullDate.getDate() + 1);
        this.setData({
          checkOut: { ...getBeijingDateInfo(newCheckOutFullDate), fullDate: newCheckOutFullDate },
          numberOfNights: 1
        });
      }
    }
  },

  bindCheckInChange: function(e) {
    const selectedDateStr = e.detail.value; // "YYYY-MM-DD"
    const selectedFullDate = new Date(selectedDateStr.replace(/-/g, '/')); // Adjust for iOS compatibility

    // 检查日期是否有效
    if (isNaN(selectedFullDate.getTime())) {
      wx.showToast({ title: '选择的入住日期无效', icon: 'none' });
      this.setData({ // 强制 WXML 使用旧的有效 checkIn 值重新渲染 picker
        checkIn: JSON.parse(JSON.stringify(this.data.checkIn))
      });
      return;
    }

    if (this.data.checkOut && this.data.checkOut.fullDate && selectedFullDate >= this.data.checkOut.fullDate) {
      // If new check-in is on or after check-out, adjust check-out
      const newCheckOutFullDate = new Date(selectedFullDate);
      newCheckOutFullDate.setDate(selectedFullDate.getDate() + 1);
      this.setData({
        checkIn: { ...getBeijingDateInfo(selectedFullDate), fullDate: selectedFullDate },
        checkOut: { ...getBeijingDateInfo(newCheckOutFullDate), fullDate: newCheckOutFullDate }
      });
    } else {
      this.setData({
        checkIn: { ...getBeijingDateInfo(selectedFullDate), fullDate: selectedFullDate }
      });
    }
    this.calculateNights();
  },

  bindCheckOutChange: function(e) {
    const selectedDateStr = e.detail.value; // "YYYY-MM-DD"
    const selectedFullDate = new Date(selectedDateStr.replace(/-/g, '/'));

    if (isNaN(selectedFullDate.getTime())) {
      wx.showToast({ title: '选择的离店日期无效', icon: 'none' });
      this.setData({ // 强制 WXML 使用旧的有效 checkOut 值重新渲染 picker
        checkOut: JSON.parse(JSON.stringify(this.data.checkOut))
      });
      return;
    }

    if (this.data.checkIn && this.data.checkIn.fullDate && selectedFullDate <= this.data.checkIn.fullDate) {
      wx.showToast({
        title: '退房日期必须在入住日期之后',
        icon: 'none'
      });
      this.setData({ 
          checkOut: JSON.parse(JSON.stringify(this.data.checkOut))
      });
      return;
    }
    this.setData({
      checkOut: { ...getBeijingDateInfo(selectedFullDate), fullDate: selectedFullDate }
    });
    this.calculateNights();
  },

  openProvinceCityPicker: function() {
    // Ensure pickerValue is valid and cities are for the current province in pickerValue
    const currentProvinceIndex = this.data.pickerValue[0];
    let citiesForCurrentProvince = [];
    if (this.data.provinces.length > currentProvinceIndex) {
        const provinceKey = this.data.provinces[currentProvinceIndex].key;
        const citiesObject = this.data.allProvinceCityData[provinceKey];
        if (citiesObject) {
            for (const key in citiesObject) {
                citiesForCurrentProvince.push(citiesObject[key]);
            }
        }
    }
    // Ensure city index in pickerValue is also valid for the citiesForCurrentProvince
    let currentCityIndex = this.data.pickerValue[1];
    if (currentCityIndex >= citiesForCurrentProvince.length) {
        currentCityIndex = 0; // Reset to first city if out of bounds
    }

    this.setData({
      showProvinceCityPicker: true,
      cities: citiesForCurrentProvince,
      pickerValue: [currentProvinceIndex, currentCityIndex] // Update pickerValue if cityIndex was adjusted
    });
  },

  closeProvinceCityPicker: function() {
    this.setData({ showProvinceCityPicker: false });
  },

  handleProvinceCityChange: function(e) {
    const val = e.detail.value; // val is [provinceIndex, cityIndex]
    const newProvinceIndex = val[0];
    const previousProvinceIndex = this.data.pickerValue[0];

    let newCities = this.data.cities;
    let newCityIndex = val[1]; // Tentative new city index

    if (newProvinceIndex !== previousProvinceIndex) {
      // Province changed, update city list and reset city selection to the first city
      newCities = [];
      if (this.data.provinces.length > newProvinceIndex) {
          const provinceKey = this.data.provinces[newProvinceIndex].key;
          const citiesObject = this.data.allProvinceCityData[provinceKey];
          if (citiesObject) {
              for (const key in citiesObject) {
                  newCities.push(citiesObject[key]);
              }
          }
      }
      newCityIndex = 0; // Reset city index to the first city of the new province
    }
    
    // Ensure newCityIndex is valid for newCities array
    if (newCityIndex >= newCities.length && newCities.length > 0) {
        newCityIndex = newCities.length -1;
    } else if (newCities.length === 0) {
        newCityIndex = 0;
    }

    this.setData({
      pickerValue: [newProvinceIndex, newCityIndex],
      cities: newCities
    });
  },

  handleSearchInput: function(e) {
    const searchQuery = e.detail.value;
    this.setData({ searchQuery: searchQuery });
    if (!searchQuery) { // If search query is cleared, update display immediately
        this.updateDisplayedHotels(); 
    }
    // For performance, you might want to debounce this if filtering on every input
    // For now, we'll filter on confirm or when search is cleared.
  },

  handleSearchConfirm: function() {
    this.updateDisplayedHotels();
  },

  clearSearchQuery: function() {
    this.setData({ searchQuery: '' });
    this.updateDisplayedHotels();
  },

  // Consolidated function to update displayed hotels based on city and search query
  updateDisplayedHotels: function() {
    const allHotels = this.data.hotels;
    const city = this.data.currentSelectedCityName;
    const query = this.data.searchQuery.toLowerCase().trim();

    let filteredHotels = allHotels;

    // 1. Filter by city (if a city is selected)
    if (city) {
      filteredHotels = filteredHotels.filter(hotel => hotel.cityName === city);
    }

    // 2. Filter by search query (if a query exists)
    if (query) {
      filteredHotels = filteredHotels.filter(hotel => {
        const nameMatch = hotel.name && hotel.name.toLowerCase().includes(query);
        const locationMatch = hotel.location && hotel.location.toLowerCase().includes(query);
        // You can also search in description or other fields if needed
        // const descriptionMatch = hotel.description && hotel.description.toLowerCase().includes(query);
        return nameMatch || locationMatch; // || descriptionMatch;
      });
    }

    this.setData({ displayedHotels: filteredHotels });
  },

  onProvinceCityConfirm: function() {
    const provinceIndex = this.data.pickerValue[0];
    const cityIndex = this.data.pickerValue[1];

    if (this.data.provinces.length === 0 || provinceIndex >= this.data.provinces.length) {
        console.error("Province data not loaded correctly or index out of bounds");
        this.setData({ showProvinceCityPicker: false });
        return;
    }
    const selectedProvinceName = this.data.provinces[provinceIndex].name;
    
    let selectedCityName = '';
    if (this.data.cities.length > 0 && cityIndex < this.data.cities.length) {
        selectedCityName = this.data.cities[cityIndex];
    } else if (this.data.cities.length > 0) { 
        selectedCityName = this.data.cities[0];
    } else {
        const provinceKey = this.data.provinces[provinceIndex].key;
        const citiesObject = this.data.allProvinceCityData[provinceKey];
        const cityKeys = Object.keys(citiesObject || {});
        if (cityKeys.length === 1 && citiesObject[cityKeys[0]] === selectedProvinceName) {
            selectedCityName = selectedProvinceName;
        } else {
            console.warn("No cities found for selected province or index issue for city selection logic in onProvinceCityConfirm:", selectedProvinceName);
            selectedCityName = selectedProvinceName; 
        }
    }

    this.setData({
      selectedProvinceCityText: `${selectedProvinceName} - ${selectedCityName}`,
      showProvinceCityPicker: false,
      currentSelectedCityName: selectedCityName // Set currentSelectedCityName here
    });
    // console.log('Selected Province-City:', `${selectedProvinceName} - ${selectedCityName}`);
    
    this.updateDisplayedHotels(); // New: Update display based on new city and existing search query
  },
  
  navigateToHotelRoomList: function(e) {
    const hotelJsonFileCloudID = e.currentTarget.dataset.jsonfilecloudid; // <<< --- CHANGED: Get the JSON FileID
    if (!this.data.checkIn || !this.data.checkIn.fullDate || !this.data.checkOut || !this.data.checkOut.fullDate) {
      wx.showToast({
        title: '请先选择有效的入住和离店日期',
        icon: 'none'
      });
      return;
    }
    const checkInDateForQuery = formatDateForPicker(this.data.checkIn.fullDate);
    const checkOutDateForQuery = formatDateForPicker(this.data.checkOut.fullDate);

    if (!hotelJsonFileCloudID) {
      console.error('[Home] navigateToHotelRoomList: hotelJsonFileCloudID is undefined. Check WXML data attribute.');
      wx.showToast({ title: '无法加载酒店详情', icon: 'none' });
      return;
    }

    wx.navigateTo({
      url: `/pages/room_list/room_list?hotelFileID=${hotelJsonFileCloudID}&checkInDate=${checkInDateForQuery}&checkOutDate=${checkOutDateForQuery}&nights=${this.data.numberOfNights}` // <<<--- CHANGED: Use hotelFileID
    });
  }
}); 