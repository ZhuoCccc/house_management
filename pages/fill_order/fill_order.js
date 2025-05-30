const app = getApp(); // Assuming you might use globalData for statusBarHeight later
const db = require('../../utils/db.js'); // Import db utils

Page({
  data: {
    // Custom Navigation Bar related
    statusBarHeight: wx.getSystemInfoSync().statusBarHeight,
    navBarHeight: wx.getMenuButtonBoundingClientRect().height + (wx.getMenuButtonBoundingClientRect().top - wx.getSystemInfoSync().statusBarHeight) * 2,
    navBarTitle: '订单填写',

    // From previous page
    roomId: null,
    roomName: '', // Initialize as empty, will be set in onLoad
    roomPrice: 0, // Price per night per room
    checkInDate: '', 
    checkOutDate: '', 
    nights: 1,

    // Form fields
    roomQuantity: 1,
    guestName: '',
    contactPhone: '',
    remarks: '',

    // Calculated
    totalPrice: 0, // Initialize to 0, will be calculated
    estimatedGuaranteeFee: 549, // Example fee from image

    // For scroll-view height calculation
    bottomBarHeight: 0 
  },

  onLoad: function (options) {
    console.log('Fill Order Page - Received Options:', options);
    const roomPrice = parseFloat(options.roomPrice || 0);
    const nights = parseInt(options.nights || 1);
    const roomQuantity = this.data.roomQuantity; // Initial quantity

    // Determine room name display, prioritizing roomNumber
    let displayRoomName = ''; // Default to empty string if no info found
    if (options.roomNumber) {
      displayRoomName = `房间：${options.roomNumber}`; // Use room number if available
    } else if (options.roomName) {
      displayRoomName = decodeURIComponent(options.roomName);
    } else if (options.roomType) {
      displayRoomName = decodeURIComponent(options.roomType); 
    }
    // If all are unavailable, displayRoomName will remain an empty string

    this.setData({
      roomId: options.roomId || null,
      roomName: displayRoomName, // Set the determined room name
      roomPrice: roomPrice,
      checkInDate: options.checkInDate || 'N/A',
      checkOutDate: options.checkOutDate || 'N/A',
      nights: nights,
      totalPrice: roomPrice * nights * roomQuantity, // Calculate initial total price
      // estimatedGuaranteeFee can also be dynamic if needed
    });
  },

  onReady: function() { 
    const query = wx.createSelectorQuery().in(this); // Important: .in(this) for custom components, good practice for pages too
    query.select('.bottom-bar').boundingClientRect(rect => {
      if (rect && rect.height) {
        console.log('Bottom bar height:', rect.height);
        this.setData({
          bottomBarHeight: rect.height
        });
      } else {
        console.warn('.bottom-bar not found or height is 0');
        // Fallback if bottom-bar height cannot be determined, e.g. a common fixed height
        // this.setData({ bottomBarHeight: 50 }); 
      }
    }).exec();
  },

  navigateBack: function() {
    wx.navigateBack();
  },

  calculateTotalPrice: function() {
    const totalPrice = this.data.roomPrice * this.data.nights * this.data.roomQuantity;
    this.setData({ totalPrice: totalPrice.toFixed(0) }); // Assuming price is integer as in image
  },

  decreaseQuantity: function() {
    if (this.data.roomQuantity > 1) {
      this.setData({ roomQuantity: this.data.roomQuantity - 1 });
      this.calculateTotalPrice();
    }
  },

  increaseQuantity: function() {
    // Add a max quantity check if necessary, e.g., max 5 rooms
    // if (this.data.roomQuantity < 5) { ... }
    this.setData({ roomQuantity: this.data.roomQuantity + 1 });
    this.calculateTotalPrice();
  },

  bindGuestNameInput: function(e) {
    this.setData({ guestName: e.detail.value });
  },

  bindContactPhoneInput: function(e) {
    this.setData({ contactPhone: e.detail.value });
  },

  bindRemarksInput: function(e) {
    this.setData({ remarks: e.detail.value });
  },

  showPriceDetails: function() {
    // Logic to show price breakdown, e.g., in a modal
    wx.showModal({
      title: '价格明细',
      content: `房费: ¥${this.data.roomPrice}/晚/间\n数量: ${this.data.roomQuantity}间\n晚数: ${this.data.nights}晚\n总价: ¥${this.data.totalPrice}`,
      showCancel: false,
      confirmText: '知道了'
    });
  },

  submitOrder: function() {
    // Validate form data
    if (!this.data.guestName.trim()) {
      wx.showToast({ title: '请输入入住人姓名', icon: 'none' });
      return;
    }
    if (!this.data.contactPhone.trim() || !/^1[3-9]\d{9}$/.test(this.data.contactPhone.trim())) {
      wx.showToast({ title: '请输入正确的手机号', icon: 'none' });
      return;
    }

    const currentUser = app.globalData.loggedInUser;
    if (!currentUser || !currentUser.username) {
      wx.showToast({ title: '用户未登录，无法提交订单', icon: 'none' });
      // Optionally redirect to login
      // wx.navigateTo({ url: '/pages/login/login' });
      return;
    }

    const orderData = {
      username: currentUser.username, // Associate order with user
      roomId: this.data.roomId,
      roomName: this.data.roomName,
      roomPricePerNight: this.data.roomPrice,
      checkInDate: this.data.checkInDate,
      checkOutDate: this.data.checkOutDate,
      nights: this.data.nights,
      roomQuantity: this.data.roomQuantity,
      guestName: this.data.guestName.trim(),
      contactPhone: this.data.contactPhone.trim(),
      remarks: this.data.remarks.trim(),
      totalPrice: this.data.totalPrice,
      orderTime: new Date().toLocaleString() // Example order time
    };

    const orderId = db.addOrder(orderData); // Save order
    console.log('Order Submitted with ID:', orderId, 'Data:', orderData);

    // Navigate to a success or order details page
    // For now, let's assume a simple success indication or back to my_orders
    wx.showToast({
      title: '订单提交成功!',
      icon: 'success',
      duration: 2000,
      complete: () => {
        // Navigate to my_orders page after toast
        // wx.redirectTo or wx.switchTab depending on your tab bar structure
        wx.switchTab({
          url: '/pages/my_orders/my_orders'
        });
      }
    });

    // The navigation to /pages/submit_order/submit_order might be premature
    // if that page is not yet created or if direct feedback is preferred.
    // Commenting out for now unless submit_order page is the intended next step.
    /*
    wx.navigateTo({
      url: '/pages/submit_order/submit_order' // We need to create this page
    });
    */
  }
}); 