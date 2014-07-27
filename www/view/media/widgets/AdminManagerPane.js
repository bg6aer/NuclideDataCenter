/**
 * Created by zhuomuniao1 on 14-6-5.
 */

$class("AdminManagerPane", [kx.Widget, kx.ActionMixin, kx.EventMixin],
{
    __constructor: function() {

    },

    onAttach: function(domNode) {
        console.log(111)
        domNode.find("a.add-admin").click(kx.bind(this, "addAdmin"));
    },

    addAdmin: function() {
        console.log(11122)
        var payload = {
            "username": this.getUsername(),
            "password_md5": this.passwordMD5()
        };
        this.ajax("user/register", payload, function(data){
            console.log(data)
        });
    },

    passwordMD5: function() {
        var p = this._domNode.find("input.password").val();
        return hex_md5(p);
    },

    getUsername: function() {
        return this._domNode.find("input.username").val();
    }


});