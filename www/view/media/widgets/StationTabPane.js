/**
 * Created by yuzhongmin on 14-6-5.
 */
$class("StationTabPane", [kx.Widget, kx.ActionMixin, kx.EventMixin],
{
    _connList: null,

    __constructor: function() {


    },

    onAttach: function(domNode) {

        var this_ = this;
        setInterval(function(){

            this_.onQueryOnline(domNode);
        }, 10000);
        this_.onQueryOnline(domNode);

        // List
        this._connList = new ListView();
        var listDomNode = this._connList.create();
        listDomNode.appendTo(domNode.find("div.conn-alert-list"));

        this._connList.setHeaders([
            {'key':'id', 'name': 'ID'},
            {'key':'begintime', 'name':'(断线)开始时间'},
            {'key':'endtime', 'name':'(断线)结束时间'}
        ]);

        var this_ = this;
        domNode.delegate('ul.nav-tabs a', 'click', function(){
            this_.onTabChanged();
        });
    },

    onQueryOnline: function(domNode) {
        this.updateOnlineString();
    },

    updateOnlineString: function() {

        this._stationId = g.getCurrentStationId();
        var stationStatusNode = this._domNode.find('div.caption span.offline');
        this.ajax('command/online/' + this._stationId, null, function(data){
            console.log(data);
            var d = eval('(' + data + ')');
            if (d['errorCode'] == 0)
            {
                var diff = d['results']['diff'];
                if (diff > 120)
                {
                    stationStatusNode.text(" (离线)")
                }
                else
                {
                    stationStatusNode.text(" (在线)")
                }
            }

        });
    },

    onTabChanged: function() {
        this.refreshConnList(g.getCurrentStationId());
    },

    refreshConnList: function(stationId) {
        console.log(stationId)
        var this_ = this;
        this.ajax("command/alive/" + stationId, null, function(data)
        {
            //console.log(data);
            var d = eval('(' + data + ')');
            if (d['errorCode'] == 0)
            {
                this_.fillList(d['results']['items'])
            }
        });
    },

    fillList: function(items) {
        var params = this._connList.clearValues();
        for (var i in items) {
            var item = items[i];
            if (item['begintime'] != item['endtime'])
            {
                this._connList.addValue(item, params);
            }

        }
        return;
    }
});