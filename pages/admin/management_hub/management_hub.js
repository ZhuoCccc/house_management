const db = require('../../../utils/db.js'); // 引入数据库操作模块
const app = getApp();

Page({
  data: {
    rooms: [], // 房间列表
    showAddRoomModal: false, // 控制添加房间模态框的显示
    newRoom: { // 新房间的表单数据
      id: '',
      roomNumber: '',
      type: '',
      status: '空闲', 
      floor: '',
      price: null,
      amenities: '' 
    },
    statusOptions: ['空闲', '入住', '打扫中', '维修中'], 
    navBarHeight: app.globalData.navBarHeight,
  },

  onLoad: function (options) {
    this.checkAdminLogin();
    this.loadRooms();
  },

  onShow: function () {
    this.checkAdminLogin();
    this.loadRooms();
  },

  checkAdminLogin: function() {
    const loggedInUser = app.globalData.loggedInUser;
    if (!loggedInUser || loggedInUser.type !== 'admin') {
      wx.redirectTo({ url: '/pages/login/login' });
    }
  },

  loadRooms: function () {
    this.setData({
      rooms: db.getAllRooms()
    });
  },

  openAddRoomModal: function () {
    this.setData({
      showAddRoomModal: true,
      newRoom: { 
        id: '',
        roomNumber: '',
        type: '',
        status: '空闲',
        floor: '',
        price: null,
        amenities: ''
      }
    });
  },

  closeAddRoomModal: function () {
    this.setData({ showAddRoomModal: false });
  },

  handleAddRoomInputChange: function (e) {
    const field = e.currentTarget.dataset.field;
    let value = e.detail.value;
    if (field === 'price') {
      value = parseFloat(value) || null;
    }
    this.setData({
      [`newRoom.${field}`]: value
    });
  },
  
  handleStatusChange: function(e) {
    this.setData({
      'newRoom.status': this.data.statusOptions[e.detail.value]
    });
  },

  saveNewRoom: function () {
    const { roomNumber, type, status, floor, price, amenities } = this.data.newRoom;
    if (!roomNumber || !type || !floor || price === null || price <= 0) {
      wx.showToast({
        title: '请填写所有必填项（价格需大于0）',
        icon: 'none'
      });
      return;
    }
    const newRoomData = {
      id: 'r' + Date.now().toString().slice(-4) + Math.random().toString(36).substr(2, 3),
      roomNumber: roomNumber.trim(),
      type: type.trim(),
      status: status,
      floor: floor.trim(),
      price: parseFloat(price),
      amenities: amenities.split('，').map(item => item.trim()).filter(item => item) 
    };
    const success = db.addRoom(newRoomData);
    if (success) {
      wx.showToast({ title: '房间添加成功', icon: 'success' });
      this.loadRooms(); 
      this.closeAddRoomModal(); 
    } else {
      wx.showToast({ title: '添加失败，房间号可能已存在', icon: 'none' });
    }
  },

  deleteRoom: function (e) {
    const roomId = e.currentTarget.dataset.roomid;
    const roomToDelete = this.data.rooms.find(r => r.id === roomId);
    if (!roomToDelete) {
        wx.showToast({ title: '未找到房间', icon: 'none' });
        return;
    }
    wx.showModal({
      title: '确认删除',
      content: `确定要删除房间 ${roomToDelete.roomNumber} 吗？此操作不可逆。`,
      success: (res) => {
        if (res.confirm) {
          const success = db.deleteRoom(roomId);
          if (success) {
            wx.showToast({ title: '删除成功', icon: 'success' });
            this.loadRooms(); 
          } else {
            wx.showToast({ title: '删除失败', icon: 'none' });
          }
        }
      }
    });
  }
}); 