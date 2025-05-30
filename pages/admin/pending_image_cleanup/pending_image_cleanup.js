const app = getApp();

Page({
  data: {
    failedDeletions: [],
    statusBarHeight: app.globalData.statusBarHeight || wx.getSystemInfoSync().statusBarHeight,
  },

  onLoad: function (options) {
    this.loadFailedDeletions();
  },

  onShow: function () {
    // Reload data in case changes were made and user navigates back
    this.loadFailedDeletions();
  },

  loadFailedDeletions: function () {
    const logs = wx.getStorageSync('failed_image_deletions') || [];
    // Sort by date, newest first (optional)
    logs.sort((a, b) => new Date(b.attemptedDeleteTime) - new Date(a.attemptedDeleteTime));
    this.setData({ failedDeletions: logs });
  },

  navigateBack: function() {
    wx.navigateBack();
  },

  viewInCloudConsole: function(e) {
    const fileID = e.currentTarget.dataset.fileid;
    wx.setClipboardData({
      data: fileID,
      success: function () {
        wx.showToast({
          title: 'FileID已复制',
          icon: 'success',
          duration: 1500
        });
      }
    });
    // You can also guide the user or provide a link/path to the console if possible,
    // but direct navigation isn't feasible.
    wx.showModal({
      title: '操作提示',
      content: `FileID: ${fileID} 已复制到剪贴板。请前往微信开发者工具的云开发控制台 -> 存储，粘贴此FileID进行搜索和手动删除。`,
      showCancel: false,
      confirmText: '知道了'
    });
  },

  confirmCleanup: function (e) {
    const fileIDToConfirm = e.currentTarget.dataset.fileid;
    wx.showModal({
      title: '确认操作',
      content: `您确定已经在云控制台手动删除了 FileID: ${fileIDToConfirm} 对应的文件吗？此操作将从本日志中移除该记录。`,
      confirmText: '是的，已删除',
      cancelText: '否',
      success: (res) => {
        if (res.confirm) {
          let logs = wx.getStorageSync('failed_image_deletions') || [];
          const updatedLogs = logs.filter(log => log.fileID !== fileIDToConfirm);
          wx.setStorageSync('failed_image_deletions', updatedLogs);
          this.setData({ failedDeletions: updatedLogs });
          wx.showToast({ title: '记录已移除', icon: 'success' });
        } 
      }
    });
  }
}); 