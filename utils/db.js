// utils/db.js

const USERS_STORAGE_KEY = 'mini_program_users_db';
const ORDERS_STORAGE_KEY = 'mini_program_orders_db';
const ROOMS_STORAGE_KEY = 'mini_program_rooms_db'; // Key for rooms
const HOTELS_STORAGE_KEY = 'mini_program_hotels_db'; // Key for hotels

// Function to generate a simple unique ID
const generateId = (prefix = 'u') => {
  return prefix + Date.now().toString().slice(-6) + Math.random().toString(36).substr(2, 4);
};

console.log('db.js: Initializing data store - v2.2 (all hotels with cloud File IDs)');

// --- Hotel Data Initialization ---
let rawHotelsFromStorage = wx.getStorageSync(HOTELS_STORAGE_KEY);
let hotels;

const CLOUD_ENV_PREFIX = 'cloud://cloud1-0gmfc74geebd1b50.636c-cloud1-0gmfc74geebd1b50-1360583575/';

// File IDs for all six hotels based on user's latest list (assumed order)
const FILE_ID_HOTEL_1 = CLOUD_ENV_PREFIX + '003.jpg';
const FILE_ID_HOTEL_2 = CLOUD_ENV_PREFIX + '006.jpg';
const FILE_ID_HOTEL_3 = CLOUD_ENV_PREFIX + '002.jpg';
const FILE_ID_HOTEL_4 = CLOUD_ENV_PREFIX + '001.jpg';
const FILE_ID_HOTEL_5 = CLOUD_ENV_PREFIX + '004.jpg';
const FILE_ID_HOTEL_6 = CLOUD_ENV_PREFIX + '005.jpg';

const DEFAULT_HOTEL_IMAGE_IDS = [
  FILE_ID_HOTEL_1,
  FILE_ID_HOTEL_2,
  FILE_ID_HOTEL_3,
  FILE_ID_HOTEL_4,
  FILE_ID_HOTEL_5,
  FILE_ID_HOTEL_6
];

// Example city names, replace with actual city names from your province_city_data.js
const EXAMPLE_CITY_NAMES = [
  "北京市", // For h001
  "三亚市", // For h002
  "上海市", // For h003
  "杭州市", // For h004
  "苏州市", // For h005
  "丽江市"  // For h006
];

if (Array.isArray(rawHotelsFromStorage) && rawHotelsFromStorage.length > 0 && rawHotelsFromStorage.every(h => h.hasOwnProperty('id') && h.hasOwnProperty('name'))) {
  console.log('db.js: Using hotels from storage. Ensuring imageFileIDs and cityNames are present.');
  hotels = rawHotelsFromStorage.map((hotel, index) => {
    let updatedHotel = { ...hotel };
    if (hotel.image) { 
        delete updatedHotel.image;
    }
    if (index < DEFAULT_HOTEL_IMAGE_IDS.length && !updatedHotel.imageFileID) {
      updatedHotel.imageFileID = DEFAULT_HOTEL_IMAGE_IDS[index];
    }
    // Add cityName if missing
    if (!updatedHotel.cityName && index < EXAMPLE_CITY_NAMES.length) {
        updatedHotel.cityName = EXAMPLE_CITY_NAMES[index];
    } else if (!updatedHotel.cityName) {
        updatedHotel.cityName = "未知城市"; // Fallback for hotels beyond the example list
    }
    return updatedHotel;
  });
} else {
  console.log('db.js: Initializing default hotels with cloud imageFileIDs and cityNames.');
  hotels = [
    { id: 'h001', name: '示例连锁酒店 (市中心店)', location: '市府大道100号', imageFileID: FILE_ID_HOTEL_1, cityName: EXAMPLE_CITY_NAMES[0], description: '位于市中心，交通便利，设施齐全。', rooms: [] },
    { id: 'h002', name: '度假天堂大酒店', location: '海滨路88号', imageFileID: FILE_ID_HOTEL_2, cityName: EXAMPLE_CITY_NAMES[1], description: '享受无敌海景，体验奢华假期。', rooms: [] },
    { id: 'h003', name: '商务快捷酒店 (机场店)', location: '空港路1号', imageFileID: FILE_ID_HOTEL_3, cityName: EXAMPLE_CITY_NAMES[2], description: '紧邻机场，专为商旅人士打造。', rooms: [] },
    { id: 'h004', name: '城市绿洲精品酒店', location: '公园路66号', imageFileID: FILE_ID_HOTEL_4, cityName: EXAMPLE_CITY_NAMES[3], description: '闹中取静，体验精品住宿。', rooms: [] },
    { id: 'h005', name: '湖畔江南庭院酒店', location: '镜湖路23号', imageFileID: FILE_ID_HOTEL_5, cityName: EXAMPLE_CITY_NAMES[4], description: '体验江南水乡的宁静与雅致。', rooms: [] },
    { id: 'h006', name: '森林秘境木屋度假村', location: '国家森林公园内', imageFileID: FILE_ID_HOTEL_6, cityName: EXAMPLE_CITY_NAMES[5], description: '拥抱自然，享受独特的木屋体验。', rooms: [] }
  ];
  hotels = hotels.map(h => ({ ...h, rooms: h.rooms || [] }));
}
wx.setStorageSync(HOTELS_STORAGE_KEY, hotels);
console.log('db.js: Final hotels count after init:', hotels.length);
console.log('db.js: Hotel 1 File ID:', hotels.length > 0 ? hotels[0].imageFileID : 'N/A');
console.log('db.js: Hotel 6 File ID:', hotels.length > 5 ? hotels[5].imageFileID : 'N/A');

// --- User Data Initialization ---
let rawUsersFromStorage = wx.getStorageSync(USERS_STORAGE_KEY);
let users;

if (Array.isArray(rawUsersFromStorage) && rawUsersFromStorage.length > 0) {
  console.log('db.js: Using users from storage.');
  users = rawUsersFromStorage;
} else {
  console.log('db.js: Initializing default users. Storage was empty or invalid.');
  users = [
    { username: 'user', password: '123', type: 'user', email: 'user@example.com' },
    { username: 'admin', password: 'admin', type: 'admin', email: 'admin@example.com' }
  ];
}

users = users.map(u => {
  // Ensure user object exists and has a type, otherwise default to 'usr' for prefix
  const userType = u && u.type === 'admin' ? 'adm' : 'usr';
  if (u && u.id && typeof u.id === 'string' && u.id.startsWith(userType)) return u; // Keep valid existing ID
  return { ...(u || {}), id: generateId(userType) }; // Ensure u is an object before spreading
});

wx.setStorageSync(USERS_STORAGE_KEY, users);
console.log('db.js: Final users count after init:', users.length);

// --- Order Data Initialization ---
let rawOrdersFromStorage = wx.getStorageSync(ORDERS_STORAGE_KEY);
let orders;
if (Array.isArray(rawOrdersFromStorage)) { // Allow empty array from storage for orders
    console.log('db.js: Using orders from storage.');
    orders = rawOrdersFromStorage;
} else {
    console.log('db.js: Initializing default empty orders array. Storage was invalid.');
    orders = [];
}
wx.setStorageSync(ORDERS_STORAGE_KEY, orders); // Save even if it's an empty array

// --- Room Data Initialization ---
let rawRoomsFromStorage = wx.getStorageSync(ROOMS_STORAGE_KEY);
let rooms;

if (Array.isArray(rawRoomsFromStorage) && rawRoomsFromStorage.length > 0 && rawRoomsFromStorage.every(r => r.hasOwnProperty('hotelId'))) {
  console.log('db.js: Using rooms from storage (with hotelId).');
  rooms = rawRoomsFromStorage.map(room => ({
    ...room,
    roomTypeImageFileID: room.roomTypeImageFileID || null // Ensure field exists
  }));
} else {
  console.log('db.js: Initializing default rooms with hotelId and roomTypeImageFileID. Storage was empty, invalid, or rooms lacked hotelId.');
  rooms = [
    // Hotel h001
    { id: 'r001', hotelId: 'h001', roomNumber: '101', type: '标准单人间', status: '空闲', floor: '1F', price: 199, amenities: ['空调', '电视', '独立卫浴'], roomTypeImageFileID: 'cloud://cloud1-0gmfc74geebd1b50.636c-cloud1-0gmfc74geebd1b50-1360583575/001.jpg' },
    { id: 'r002', hotelId: 'h001', roomNumber: '102', type: '标准双人间', status: '入住', floor: '1F', price: 299, amenities: ['空调', '电视', '独立卫浴', '窗户'], roomTypeImageFileID: 'cloud://cloud1-0gmfc74geebd1b50.636c-cloud1-0gmfc74geebd1b50-1360583575/002.jpg' },
    // Hotel h002
    { id: 'r003', hotelId: 'h002', roomNumber: '103', type: '标准单人间', status: '打扫中', floor: '1F', price: 199, amenities: ['空调', '电视', '独立卫浴'], roomTypeImageFileID: null },
    { id: 'r004', hotelId: 'h002', roomNumber: '201', type: '豪华单人间', status: '空闲', floor: '2F', price: 350, amenities: ['空调', '电视', '独立卫浴', '浴缸', '迷你吧'], roomTypeImageFileID: null },
    // Hotel h003
    { id: 'r005', hotelId: 'h003', roomNumber: '202', type: '豪华双人间', status: '维修中', floor: '2F', price: 450, amenities: ['空调', '电视', '独立卫浴', '浴缸', '迷你吧', '沙发'], roomTypeImageFileID: null },
    { id: 'r006', hotelId: 'h003', roomNumber: '203', type: '行政套房', status: '入住', floor: '2F', price: 680, amenities: ['中央空调', '高清电视', '豪华卫浴', '会客区', '办公桌'], roomTypeImageFileID: null },
    // Hotel h004
    { id: 'r007', hotelId: 'h004', roomNumber: '301', type: '标准单人间', status: '空闲', floor: '3F', price: 199, amenities: ['空调', '电视', '独立卫浴'], roomTypeImageFileID: null },
    { id: 'r008', hotelId: 'h004', roomNumber: '302', type: '标准双人间', status: '空闲', floor: '3F', price: 299, amenities: ['空调', '电视', '独立卫浴', '窗户'], roomTypeImageID: null },
    // Hotel h005 (New Rooms)
    { id: 'r009', hotelId: 'h005', roomNumber: 'L101', type: '湖景大床房', status: '空闲', floor: '1F', price: 780, amenities: ['空调', '电视', '观景阳台', '浴缸'], roomTypeImageFileID: null },
    { id: 'r010', hotelId: 'h005', roomNumber: 'L102', type: '湖景双床房', status: '空闲', floor: '1F', price: 820, amenities: ['空调', '电视', '观景阳台', '浴缸', '沙发'], roomTypeImageFileID: null },
    // Hotel h006 (New Rooms)
    { id: 'r011', hotelId: 'h006', roomNumber: 'F201', type: '森林小木屋A', status: '入住', floor: '2F', price: 950, amenities: ['壁炉', '独立庭院', '厨房', '烧烤架'], roomTypeImageFileID: null },
    { id: 'r012', hotelId: 'h006', roomNumber: 'F202', type: '森林小木屋B', status: '空闲', floor: '2F', price: 990, amenities: ['壁炉', '独立庭院', '厨房', '烧烤架', '按摩浴缸'], roomTypeImageFileID: null }
  ];
  wx.setStorageSync(ROOMS_STORAGE_KEY, rooms); // Save the newly initialized rooms with hotelId
}

console.log('db.js: Final rooms count after init:', rooms.length);

function saveUsers() {
  wx.setStorageSync(USERS_STORAGE_KEY, users);
}

function saveOrders() {
  wx.setStorageSync(ORDERS_STORAGE_KEY, orders);
}

function saveRooms() { // Function to save rooms to storage
  wx.setStorageSync(ROOMS_STORAGE_KEY, rooms);
}

function saveHotels() { // Function to save hotels to storage
  wx.setStorageSync(HOTELS_STORAGE_KEY, hotels);
}

// Function to find a user by username
function findUser(username) {
  return users.find(user => user.username === username);
}

// Function to find a user by ID
function findUserById(userId) {
  return users.find(user => user.id === userId);
}

// Function to add a new user
function addUser(newUser) {
  if (findUser(newUser.username)) {
    console.error('Error adding user: Username already exists.', newUser.username);
    return false; 
  }
  // Ensure new user has an ID
  const userToAdd = { ...newUser, id: newUser.id || generateId(newUser.type === 'admin' ? 'adm' : 'usr') };
  users.push(userToAdd);
  saveUsers();
  return true;
}

// Function to update an existing user by ID
function updateUser(userId, updatedUserData) {
  const userIndex = users.findIndex(user => user.id === userId);
  if (userIndex === -1) {
    console.error('Error updating user: User ID not found.', userId);
    return false;
  }
  // Prevent changing username to one that already exists (unless it's the same user)
  if (updatedUserData.username && updatedUserData.username !== users[userIndex].username) {
      if (findUser(updatedUserData.username)) {
          console.error('Error updating user: New username already exists.', updatedUserData.username);
          return false;
      }
  }
  users[userIndex] = { ...users[userIndex], ...updatedUserData };
  saveUsers();
  return true;
}

// Function to delete a user by ID
function deleteUserById(userId) {
  const initialLength = users.length;
  users = users.filter(user => user.id !== userId);
  if (users.length < initialLength) {
    saveUsers();
    return true;
  }
  console.error('Error deleting user: User ID not found or already deleted.', userId);
  return false;
}

// Function to add an order
function addOrder(orderData) {
  const newOrder = {
    orderId: 'ORD' + Date.now() + Math.random().toString(36).substr(2, 5),
    ...orderData,
    status: orderData.status || '待支付', // Default status
    orderTime: new Date().toLocaleString()
  };
  orders.push(newOrder);
  saveOrders();
  console.log('Order added with ID:', newOrder.orderId, newOrder);
  return newOrder.orderId;
}

// Function to get orders by username
function getOrdersByUsername(username) {
  return orders.filter(order => order.username === username);
}

// Function to get all orders for display (admin or general use)
function getAllOrdersForDisplay() {
  return JSON.parse(JSON.stringify(orders));
}

// Function to clear all orders from storage
function clearAllOrdersFromStorage() {
  orders = [];
  saveOrders(); // Persist the empty orders array
  // Also clear from storage directly
  wx.removeStorageSync(ORDERS_STORAGE_KEY);
  console.log('All orders cleared from storage.');
}

// Function to get all rooms for display
function getAllRooms() {
  return JSON.parse(JSON.stringify(rooms));
}

// Function to get all users for display
function getAllUsers() {
  // The 'users' variable is already initialized and ID-checked at the top of db.js
  return JSON.parse(JSON.stringify(users));
}

// Function to add a new room
function addRoom(newRoomData) {
  console.log('[db.js] addRoom: Called with newRoomData:', JSON.stringify(newRoomData));

  if (!newRoomData.hotelId) {
    console.error('[db.js] Error adding room: hotelId is required.');
    return false;
  }

  const newGeneratedId = 'r' + Date.now().toString().slice(-6) + Math.random().toString(36).substr(2, 4);
  
  // Ensure properties from newRoomData (like status, amenities) are used if they exist,
  // but the ID is always newly generated and takes precedence.
  const roomToAdd = {
    ...newRoomData, // Spread newRoomData first
    id: newGeneratedId, // Assign the new ID AFTER spreading. This guarantees it uses the new ID.
    // Explicitly set defaults if not provided in newRoomData, or if newRoomData might have null/undefined for these
    status: newRoomData.status || '空闲', 
    amenities: newRoomData.amenities || [], 
    roomTypeImageFileID: newRoomData.roomTypeImageFileID !== undefined ? newRoomData.roomTypeImageFileID : null
  };

  console.log('[db.js] addRoom: roomToAdd object prepared (ID should be new):', JSON.stringify(roomToAdd));
  console.log('[db.js] addRoom: Current rooms count before push:', rooms ? rooms.length : 'rooms array is null/undefined');

  try {
    if (!Array.isArray(rooms)) {
        console.error('[db.js] addRoom: CRITICAL - rooms array is not an array! Initializing to empty array.');
        rooms = [];
    }
    rooms.push(roomToAdd);
    console.log('[db.js] addRoom: rooms count after push:', rooms.length);
    saveRooms(); // This calls wx.setStorageSync
    console.log('[db.js] addRoom: saveRooms() called successfully.');
  } catch (e) {
    console.error('[db.js] addRoom: Error during rooms.push or saveRooms():', e);
    // Depending on the error, you might want to return false or re-throw
    return false; // Return false on error during push/save to indicate failure
  }

  if (typeof roomToAdd.id === 'string' && roomToAdd.id.startsWith('r')) {
    console.log('[db.js] addRoom: Successfully added room. Returning ID:', roomToAdd.id);
    return roomToAdd.id;
  } else {
    console.error('[db.js] addRoom: CRITICAL - roomToAdd.id is not a valid string ID before returning. ID was:', roomToAdd.id, 'Type:', typeof roomToAdd.id);
    // This case should ideally not be reached if newId generation is correct.
    // Returning false to indicate a problem with ID generation or assignment.
    return false; 
  }
}

// Function to delete a room by ID
function deleteRoom(roomId) {
  const initialLength = rooms.length;
  rooms = rooms.filter(room => room.id !== roomId);
  if (rooms.length < initialLength) {
    saveRooms();
    return true; 
  }
  return false; 
}

// Updated function to modify room details
function updateRoomDetails(roomId, updatedDetails) {
  const roomIndex = rooms.findIndex(room => room.id === roomId);
  if (roomIndex === -1) {
    console.error('Error updating room details: Room ID not found.', roomId);
    return false;
  }

  // Ensure not to overwrite hotelId if not explicitly provided in updatedDetails
  // And also ensure that essential fields like `type` and `price` are handled correctly, converting if necessary.
  const currentRoom = rooms[roomIndex];
  const newDetails = { ...updatedDetails }; // Create a mutable copy

  // Handle price conversion explicitly if present
  if (newDetails.hasOwnProperty('price')) {
    newDetails.price = parseFloat(newDetails.price);
    if (isNaN(newDetails.price)) {
      console.warn('Attempted to update room price with non-numeric value, price update skipped for this field.', updatedDetails.price);
      delete newDetails.price; // Don't update with NaN
    }
  }

  // Ensure amenities is an array
  if (newDetails.hasOwnProperty('amenities') && !Array.isArray(newDetails.amenities)) {
    console.warn('Attempted to update amenities with non-array value, converting to array.', newDetails.amenities);
    newDetails.amenities = [newDetails.amenities.toString()]; // Basic conversion
  }
  
  // Explicitly include roomTypeImageFileID if it's part of updatedDetails, otherwise keep the old one
  // This ensures that if updatedDetails doesn't contain roomTypeImageFileID, it's not accidentally wiped out.
  // However, if it IS in updatedDetails (even if null), it should be updated.
  if (!updatedDetails.hasOwnProperty('roomTypeImageFileID')) {
    delete newDetails.roomTypeImageFileID; // Prevent accidental override if not passed
  }

  rooms[roomIndex] = { 
    ...currentRoom, 
    ...newDetails 
  };

  saveRooms();
  return true;
}

// New function to get rooms by hotel ID
function getRoomsByHotelId(hotelId) {
  if (!hotelId) {
    console.warn('getRoomsByHotelId called without a hotelId');
    return []; // Or return all rooms, depending on desired behavior for no ID
  }
  const filteredRooms = rooms.filter(room => room.hotelId === hotelId);
  return JSON.parse(JSON.stringify(filteredRooms));
}

// --- Hotel Management Functions ---
function _initializeHotelsIfNeeded() {
  if (!hotels) {
    console.warn('db.js: hotels array was not initialized. Re-initializing from _initializeHotelsIfNeeded.');
    let storedHotels = wx.getStorageSync(HOTELS_STORAGE_KEY);
    if (Array.isArray(storedHotels) && storedHotels.length > 0 && storedHotels.every(h => h.hasOwnProperty('id') && h.hasOwnProperty('name'))) {
      hotels = storedHotels.map((hotel, index) => {
        let updatedHotel = { ...hotel };
        if (hotel.image) { delete updatedHotel.image; }
        // Ensure the first 6 hotels from storage have their designated cloud image File ID
        if (index < DEFAULT_HOTEL_IMAGE_IDS.length && !updatedHotel.imageFileID) {
          updatedHotel.imageFileID = DEFAULT_HOTEL_IMAGE_IDS[index];
        }
        return updatedHotel;
      });
      console.log('db.js: Hotels re-initialized from storage (in _initializeHotelsIfNeeded). Count:', hotels.length);
    } else {
      console.log('db.js: Initializing default hotels (in _initializeHotelsIfNeeded) with all cloud File IDs.');
      hotels = [
        { id: 'h001', name: '示例连锁酒店 (市中心店)', location: '市府大道100号', imageFileID: FILE_ID_HOTEL_1, cityName: EXAMPLE_CITY_NAMES[0], description: '位于市中心，交通便利，设施齐全。', rooms: [] },
        { id: 'h002', name: '度假天堂大酒店', location: '海滨路88号', imageFileID: FILE_ID_HOTEL_2, cityName: EXAMPLE_CITY_NAMES[1], description: '享受无敌海景，体验奢华假期。', rooms: [] },
        { id: 'h003', name: '商务快捷酒店 (机场店)', location: '空港路1号', imageFileID: FILE_ID_HOTEL_3, cityName: EXAMPLE_CITY_NAMES[2], description: '紧邻机场，专为商旅人士打造。', rooms: [] },
        { id: 'h004', name: '城市绿洲精品酒店', location: '公园路66号', imageFileID: FILE_ID_HOTEL_4, cityName: EXAMPLE_CITY_NAMES[3], description: '闹中取静，体验精品住宿。', rooms: [] },
        { id: 'h005', name: '湖畔江南庭院酒店', location: '镜湖路23号', imageFileID: FILE_ID_HOTEL_5, cityName: EXAMPLE_CITY_NAMES[4], description: '体验江南水乡的宁静与雅致。', rooms: [] },
        { id: 'h006', name: '森林秘境木屋度假村', location: '国家森林公园内', imageFileID: FILE_ID_HOTEL_6, cityName: EXAMPLE_CITY_NAMES[5], description: '拥抱自然，享受独特的木屋体验。', rooms: [] }
      ];
      hotels = hotels.map(h => ({ ...h, rooms: h.rooms || [] }));
      wx.setStorageSync(HOTELS_STORAGE_KEY, hotels);
      console.log('db.js: Default hotels re-initialized and saved (in _initializeHotelsIfNeeded). Count:', hotels.length);
    }
  }
  // Also ensure rooms is initialized for deleteHotel logic
  if (!rooms) {
    console.warn('db.js: rooms array was not initialized. Re-initializing from _initializeHotelsIfNeeded (called by hotel functions).');
    let storedRooms = wx.getStorageSync(ROOMS_STORAGE_KEY);
    if (Array.isArray(storedRooms) && storedRooms.every(r => r.hasOwnProperty('hotelId'))) {
        rooms = storedRooms;
    } else {
        // Initialize with default or empty if necessary, this matches global rooms init
        rooms = []; // Or your default rooms initialization logic if it makes sense here
        // For simplicity, assuming rooms should at least be an empty array if not found.
        // The main room initialization happens earlier in the script.
    }
    console.log('db.js: Rooms re-initialized for hotel functions. Count:', rooms.length);
  }
}

function getHotels() {
  _initializeHotelsIfNeeded(); // Ensure hotels are loaded before returning
  return JSON.parse(JSON.stringify(hotels || []));
}

function getHotelById(hotelId) {
  _initializeHotelsIfNeeded();
  if (!hotels) return null;
  const hotel = hotels.find(h => h.id === hotelId);
  return hotel ? JSON.parse(JSON.stringify(hotel)) : null;
}

function updateHotel(hotelId, updatedData) {
  _initializeHotelsIfNeeded();
  if (!hotels) {
    console.error("db.js updateHotel: Hotels array critically not initialized.");
    return false;
  }
  const hotelIndex = hotels.findIndex(h => h.id === hotelId);
  if (hotelIndex === -1) {
    console.error('Error updating hotel: Hotel ID not found.', hotelId);
    return false;
  }

  // Prevent changing hotel name to one that already exists (unless it's the same hotel being edited)
  if (updatedData.name && updatedData.name.trim() !== hotels[hotelIndex].name) {
    const trimmedNewName = updatedData.name.trim();
    if (hotels.some(h => h.name === trimmedNewName && h.id !== hotelId)) {
        console.error('Error updating hotel: New hotel name already exists.', trimmedNewName);
        wx.showToast({ title: `名称 '${trimmedNewName}' 已被其他酒店使用`, icon: 'none', duration: 2500 });
        return false; // Indicate failure due to duplicate name
    }
    // If name is being updated, update the trimmed version
    updatedData.name = trimmedNewName;
  }

  // Merge existing hotel data with updated data
  // Ensure rooms array is preserved if not part of updatedData
  const currentRooms = hotels[hotelIndex].rooms;
  hotels[hotelIndex] = { 
    ...hotels[hotelIndex], 
    ...updatedData 
  };
  if (!updatedData.hasOwnProperty('rooms')) { // If updatedData doesn't explicitly change rooms, keep the old ones
    hotels[hotelIndex].rooms = currentRooms;
  }

  saveHotels();
  console.log('db.js: Hotel updated successfully:', hotelId, hotels[hotelIndex]);
  return true;
}

function addHotel(newHotelData) {
  _initializeHotelsIfNeeded(); // Ensure hotels are loaded

  if (!hotels) { 
      console.error("db.js addHotel: Hotels array critically not initialized even after check. Cannot add hotel.");
      wx.showModal({
        title: '添加失败',
        content: '酒店数据未能正确加载，请稍后重试或联系管理员。错误码: DB_H_INIT_FAIL',
        showCancel: false
      });
      return false;
  }

  const hotelNameTrimmed = newHotelData.name ? newHotelData.name.trim() : '';
  if (!hotelNameTrimmed) {
    console.error('Error adding hotel: Hotel name is empty or undefined.', newHotelData);
    wx.showModal({
        title: '添加失败',
        content: '酒店名称不能为空，请重新输入。',
        showCancel: false
      });
    return false;
  }

  const existingHotel = hotels.find(hotel => hotel.name === hotelNameTrimmed);
  if (existingHotel) {
    console.error('Error adding hotel: Hotel name already exists.', hotelNameTrimmed);
    wx.showModal({
        title: '添加失败',
        content: `酒店名称 "${hotelNameTrimmed}" 已经存在，请使用其他名称。`,
        showCancel: false
      });
    return false;
  }
  
  const hotelToAdd = { 
    ...newHotelData,
    name: hotelNameTrimmed, // Use trimmed name
    id: newHotelData.id || generateId('h'),
    rooms: newHotelData.rooms || []
  };
  
  try {
    hotels.push(hotelToAdd);
    saveHotels();
    console.log('db.js: Hotel added successfully:', hotelToAdd);
    return true;
  } catch (e) {
    console.error('db.js addHotel: Exception during hotels.push or saveHotels.', e);
    wx.showModal({
        title: '添加异常',
        content: `保存酒店信息时发生错误: ${e.message}. 请联系管理员。错误码: DB_H_SAVE_EXC`,
        showCancel: false
      });
    return false;
  }
}

function deleteHotel(hotelId) {
  _initializeHotelsIfNeeded(); // Ensure hotels and rooms are loaded

  if (!hotels || !rooms) { 
    console.error("db.js deleteHotel: Hotels or Rooms array critically not initialized. Cannot delete hotel.");
     wx.showModal({
        title: '删除失败',
        content: '数据未能正确加载，无法删除酒店。请稍后重试或联系管理员。错误码: DB_HD_INIT_FAIL',
        showCancel: false
      });
    return false;
  }
  if (!hotelId) {
    console.error('db.js deleteHotel: hotelId is undefined or null.');
    wx.showModal({
        title: '删除失败',
        content: '无效的酒店ID，无法删除。错误码: DB_HD_INVALID_ID',
        showCancel: false
      });
    return false;
  }

  const initialHotelsLength = hotels.length;
  hotels = hotels.filter(hotel => hotel.id !== hotelId);
  
  if (hotels.length < initialHotelsLength) {
    saveHotels();
    const initialRoomsLength = rooms.length;
    rooms = rooms.filter(room => room.hotelId !== hotelId);
    if (rooms.length < initialRoomsLength) {
      saveRooms();
      console.log(`db.js: Deleted rooms associated with hotelId ${hotelId}. Count: ${initialRoomsLength - rooms.length}`);
    }
    console.log('db.js: Hotel deleted successfully:', hotelId);
    return true;
  }
  console.error('Error deleting hotel: Hotel ID not found or already deleted.', hotelId);
  // No wx.showModal here as this might be a common case if delete is clicked twice, 
  // but the calling page should provide user feedback.
  return false;
}

module.exports = {
  findUser,
  findUserById,
  addUser,
  updateUser,
  deleteUserById,
  addOrder,
  getOrdersByUsername,
  getAllOrdersForDisplay,
  clearAllOrdersFromStorage,
  getAllRooms,
  getRoomsByHotelId,
  getAllUsers,
  addRoom,
  deleteRoom,
  updateRoomDetails,
  getHotels,
  getHotelById,
  updateHotel,
  addHotel,
  deleteHotel
}; 