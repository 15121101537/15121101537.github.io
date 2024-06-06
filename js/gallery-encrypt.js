(function () {
  var $btnDecrypt = $('#btn_decrypt');
  var $inputPass = $('#pass');
  var $encryptBlog = $('#encrypt-blog');
  
  $btnDecrypt.click(function () {
    var pass = $inputPass.val();
    try {
      var decrypted = CryptoJS.AES.decrypt($encryptBlog.data('encrypted'), pass).toString(CryptoJS.enc.Utf8);
      if (!decrypted) {
        throw new Error('Wrong password');
      }
      $encryptBlog.html(decrypted).show();
      $('#hbe-security').hide();
    } catch (e) {
      alert('����ʧ�ܣ����������Ƿ���ȷ��');
    }
  });
})();
