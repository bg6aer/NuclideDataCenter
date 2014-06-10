/**
 * Created by Healer on 14-6-9.
 */

$class("Sidebar", [kx.Widget, kx.ActionMixin, kx.EventMixin],
{
    _currentStationId: -1,

    _currentStationName: "",

    __constructor: function() {
    },

    onAttach: function(domNode) {

        this.ajax("main/stations/1", null, function(data){


            var ul = domNode.find('ul.stations');
            var res = eval("(" + data + ")");
            var stations = res['results']['items'];
            for (var i in stations)
            {
                var s = stations[i];
                var html = "<li><a href='#stations-row'>" + s.name + "</a></li>";
                var li = $(html);
                li.attr("station_id", s.station_id);
                ul.append(li)
            }

            var self = this;
            ul.find("li a").bind("click", function(){
                var li = $(this).parent();
                self.onStationClicked(li);
                return false;
            });
        });
    },

    getCurrentStationId: function() {
        return g.getCurrentStationId();
    },

    getCurrentStationName: function() {
        return this._currentStationName;
    },

    onStationClicked: function(li) {
        var currentStationId = li.attr("station_id")
        g.setCurrentStationId(currentStationId)
        this._currentStationName = li.find("a").text();
        console.log(this.getCurrentStationId());

        $('#network-row').hide();
        $('#devices-row').hide();
        $('#admin-row').hide();

        $('#station-row').show();

        var breadcrumb = Widget.widgetById("breadcrumb");
        breadcrumb.setLevels(
            [
                {"url":"#network", "name":"监测网络", "type":"network"},
                {"url":"#station" + currentStationId, "name":this._currentStationName, "type":"station" }
            ]);

        return false;
    }



});