
//////////////////////////////////////////////////////////////////////////
// Device Table Pane
$class("DeviceTabPane", [kx.Widget, kx.ActionMixin, kx.EventMixin],
{
	__constructor: function(secret) {

    },

	onAttach: function(domNode) {

        kx.activeWeb(domNode);

	}
});

//////////////////////////////////////////////////////////////////////////
// Devices Base
// ZM: 所以有一个DeviceBase：就是因为所有设备的很多代码写出来是雷同的，不写个基类，那么重复代码太多了。
// 因为它们的很多行为是一样的，所以可以抽象出来一个基类。
// 比如说，它们都有列表，（基本）都有曲线，等等。处理数据基本是一致的，只有具体的差别。
$class("DeviceBase", [kx.Widget, Charts, kx.ActionMixin, kx.EventMixin],
{
    _dataListView: null,

    _alertListView: null,

    _items: null,

    PageCount: 100,

    AlertPageCount: 50,

    __constructor: function() {
        // the date picker show today as default.
        this._today = true;
    },

    getPageEvent: function() {
        return this.widgetId() + "-pager";
    },

    getAlertPageEvent: function() {
        return this.widgetId() + "-alert-pager";
    },

    onAttach: function(domNode) {
        var dataPane = domNode.find("div.data-pane");
        // ZM： 每个设备都有List显示数据吧?
        this._dataListView = new ListView();
        var dataListViewDomNode = this._dataListView.create();
        dataListViewDomNode.appendTo(dataPane);

        $('<div class="pagebar"></div>').appendTo(dataPane.parent());

        // var alertPagePane = domNode.find('div.alert-pane-page');

        this._alertListView = new ListView();
        var alertListViewDomNode = this._alertListView.create();
        alertListViewDomNode.appendTo(domNode.find("div.alert-pane"));

        var this_ = this;
        this._alertListView.setHeaders([
            {'key':'id', 'type': 'id', 'checkbox': true},
            {'key':'time', 'name':'时间'},
            {'key':'field', 'name':'报警字段'},
            {'key':'value', 'name':'报警值'},
            // {'key':'handled', 'name':'处理结果'},

        ]);

        this._domNode.find('.alert-select').bind('change', kx.bind(this, "onAlertLevelSelectChanged"));

        // 每个设备都能响应时间变化而改变数据内容呈现吧？
        $('body').bind('transfer-selected-time', function(event, startTime, endTime) {
            this_.dateRangeChanged && this_.dateRangeChanged(startTime, endTime);
        });

        var self = this;
        // ZM: 在设备派生类里面,如果_noAlertData不是true，那么在基类里面就能初始化报警的代码。
        // 注意_noAlertData是放到派生类里面。只有设备才知道哪些设备要报警，哪些不需要。
        // 但是统一都在基类一份代码干了。大不了不做。
        if (!this._noAlertData)
        {
            this.ajax("alert/config/" + this._deviceType, null, function(data){
                var fc = eval("(" + data + ")");

                self._alertSettingPane = new SettingPane(self._deviceType);
                var dn = self._alertSettingPane.create();

                dn.appendTo(self._domNode.find('div.config'));
                self._alertSettingPane.setAlertFields(fc['results'])

            });
        }


        this._domNode.delegate('a.handle', 'click', function(){
            var a = $(this);

            var c = self._alertListView.getCheckedItems();

            var idList = [];
            var trList = [];
            c.each(function(i, a){
                idList.push($(a).attr('item-id'));
                trList.push($(a).parent().parent());
            } );

            self.handleAlert(self._deviceType, idList.join(','), trList, a.siblings('input').val() )
        });


        // Tab Item Changed!
        domNode.find('ul.nav-tabs li').delegate('a', 'click', function(){
            var tabItem = $(this);
            setTimeout(function(){self.postOnTabChanged(tabItem);}, 200);
        });

        this.initIntervalChange(domNode.find('div.interval'));
        this.initChartIntervalChange(domNode.find('div.chart-interval'));

        domNode.find('select.chart-field').change(kx.bind(this, function(){
            this.onFieldChanged && this.onFieldChanged();
        }));

        domNode.find('a.export').click(function () {
           self.onExport($(this));
        });

        this.initRefreshBar(domNode);
    },

    initRefreshBar: function(domNode) {
        var this_ = this;
        var bar = domNode.find('div.refresh-bar');

        bar.delegate('a', 'click', function(){
            this_.onShow();
            bar.fadeOut();
        });

        setInterval(kx.bind(this, function(){
            if (this._today)
            {
                this.hasLatestData(bar);
            }
        }), 100000);
        return false;
    },

    hasLatestData: function(bar) {
        // bar.css('display', '');

        var station = g.getCurrentStationId();
        var url = "data/latest/" + station + "/" + this._deviceType;

        this.ajax(url, null, function(data) {

            var r = eval("(" + data + ")");
            var latest = r['results']['status']

            if (latest > this._lastestDataTime)
            {
                bar.css('display', '');
            }
        });

        return true;
    },


    onFieldChanged: function() {
        this.updateCharts && this.updateCharts();
    },

    initIntervalChange: function(domNode) {
        if (!domNode.hasClass('interval'))
            return false;
        var this_ = this;
        domNode.delegate('a', 'click', function(){
            var sender = $(this);

            sender.siblings().removeClass('red');
            sender.addClass('red');

            this_.onIntervalChanged && this_.onIntervalChanged($(this));

            this_.shiftIntervalView(sender, 1);
        });
    },

    initChartIntervalChange: function(domNode) {
        if (!domNode.hasClass('chart-interval'))
            return false;
        var this_ = this;
        domNode.delegate('a', 'click', function(){
            var sender = $(this);

            sender.siblings().removeClass('red');
            sender.addClass('red');

            this_.onChartIntervalChanged && this_.onChartIntervalChanged($(this));
        });
    },

    shiftIntervalView: function(sender, page) {

        if (sender.hasClass('m5')) {
            this.fillList5min(page);
        } else if (sender.hasClass('s30')) {
            this.fillList(page);
        } else if (sender.hasClass('h1')) {
            this.fillList1Hour(page);
        }else if (sender.hasClass('d1')) {
            this.fillList1Day(page);
        } else {
            this.fillListDefault(page);
        }
    },

    handleAlert: function(deviceType, idList, trList, content) {

        this.ajax("alert/handle", {'device': deviceType, 'idList': idList}, function(data) {
            var $r = eval("(" + data + ")");
            // console.log(data);
            if ($r.errorCode == 0) {
                for (var i in trList)
                {
                    trList[i].find('td').css('background-color', '#99CC99');
                }
            }
        })
    },

    updatePageBar: function(itemsCount, page) {

        var pageBarContainer = this._domNode.find('div.pagebar');
        pageBarContainer.empty();
        if (this._pageBar)
        {
            this.unbindEvent(this, this.getPageEvent());
        }

        if (page == 0)
        {
            console.log('page is 0!')
            return;
        }

        this._pageBar = new Pagebar({pageCount: Math.floor(itemsCount / this.PageCount) + 1, page: page});
        this._pageBar.create().appendTo(pageBarContainer);
        this._pageBar.setPageEvent(this, this.getPageEvent());
        var this_ = this;
        this.bindEvent(this, this.getPageEvent(), function(e, sender, data){
            console.log('Page',data);
            var sender = this_._domNode.find('div.interval a.red');
            this_.shiftIntervalView(sender, data);
        });

        this.decorateList && this.decorateList();
        return false;
    },

    fetchAlerts: function(level, page) {
        var currentStationId = g.getCurrentStationId();
        if (currentStationId)
        {
            var api = "data/alerts/" + currentStationId + "/" + this._deviceType +'/' + level;
            console.log(api);
            this._alertListView.setPage(page);
            this._alertListView.refresh(api, null, kx.bind(this, 'onAlertsDataReceived'));
        }
    },

    onAlertsDataReceived: function(data) {
        var results = eval("(" + data + ")")['results'];
        var items = results['items']
        this._items = items;
        var count = items.length;
        console.log(count);
        this._alertListView.fillItems(this._items, this.AlertPageCount);

        this.updateAlertPageBar( count, this._alertListView.getPage() );
    },

    fetchData: function(payload)
    {
        if (this._currentShownDevice != this._deviceType)
            return;

        // ZM: BigData:
        // 这里这么处理，如果开始和结束时间差距小，维持以前的处理，把payload['interval'] 设为 30
        // 否则就设为3600先，这样得到的每小时的平均值，数据一下子少了120倍。
        // 但是在JS这段要做很多处理，把界面选择5分，30秒那些按钮去掉。
        // 把曲线的interval也响应的设为3600，曲线也能正确显示了。
        // payload['interval'] = 3600;

        //三天
        var beginTime = new Date(payload['start'].replace(/-/g,"\/"));
        var endTime = new Date(payload['end'].replace(/-/g,"\/"));
        console.log("相差时间：" + (endTime - beginTime));

        var diff = (endTime - beginTime) / 1000 / 3600 / 24;
        if(diff <= 3){
            console.log("少于三天");
            payload['interval'] = 30;
            this._step = 30 * 1000;
            this._chartInterval = 30 * 1000;
        }
        else if (diff > 3 && diff <= 6)
        {
            payload['interval'] = 300;
            this._step = 300 * 1000;
            this._chartInterval = 300 * 1000;
        }
        else if (diff > 6 && diff <= 10)
        {
            payload['interval'] = 3600;
            this._step = 3600 * 1000;
            this._chartInterval = 3600 * 1000;
        }
        else if (diff > 10)
        {
            payload['interval'] = 3600 * 24;
            this._step = 24 * 3600 * 1000;
            this._chartInterval = 24 * 3600 * 1000;
        }


        var this_ = this;
        this.updateIntervalButtons1(this._chartInterval);
        this.updateIntervalButtons2(this._chartInterval);
        var currentStationId = g.getCurrentStationId();

        if (currentStationId)
        {
            var api = "data/fetch/" + currentStationId + "/" + this._deviceType;

            // console.log(payload)
            console.log(payload);
            this.ajax(api, payload, function(data){
                var $r = eval("(" + data + ")");
                var items = $r.results.items;
                this_._items = items;
                // console.log(data);
                // Fetch today data and has data.
                console.log(items.length, this_._today);
                if (items.length > 0 && this_._today)
                {
                    this_._lastestDataTime = g.getUnixTime();
                }
                this_.makeDataDict(items);

                this_.renderData(this_._chartInterval);

            });
        }
    },

    updateIntervalButtons: function(interval, csscls) {
        // console.log(interval);
        var n = this._domNode.find(csscls);
        this._domNode.find(csscls).find('a').removeClass('red');
        if (interval == 30 * 1000) {
            n.find('a.s30').css('display', '').addClass('red');
            n.find('a.m5').css('display', '');
            n.find('a.h1').css('display', '');
            n.find('a.d1').css('display', '');

        } else if (interval == 300 * 1000) {
            n.find('a.s30').css('display', 'none');
            n.find('a.m5').css('display', '').addClass('red');
            n.find('a.h1').css('display', '');
            n.find('a.d1').css('display', '');

        } else if (interval == 3600 * 1000) {

            n.find('a.s30').css('display', 'none');
            n.find('a.m5').css('display', 'none');
            n.find('a.h1').css('display', '').addClass('red');
            n.find('a.d1').css('display', '');
        }
        else if (interval == 24 * 3600 * 1000) {
            n.find('a.s30').css('display', 'none');
            n.find('a.m5').css('display', 'none');
            n.find('a.h1').css('display', 'none');
            n.find('a.d1').css('display', '').addClass('red');
        }
    },

    updateIntervalButtons1: function (interval) {
        this.updateIntervalButtons(interval, '.interval');
    },

    updateIntervalButtons2: function(interval) {
        this.updateIntervalButtons(interval, '.chart-interval');
    },

    renderData: function(_chartInterval)
    {
        if (this._onChartsPage)
        {
            this.updateCharts();
        }
        else
        {
            this.fillList(1);
            return;

            if (_chartInterval == 24 * 3600 * 1000)
            {
                this.fillList1Day(1);
            }
            else
            {
                this.fillList(1);
            }
        }
    },

    onHide: function() {
    },

    // ---------------------------------------------------------
    // Widget.widgetById(this._deviceType + "-device").onShow();
    onShow: function()
    {
        this._currentShownDevice = this._deviceType;

        var payload = {
            start: g.getBeginTime('yyyy-MM-dd'),
            end: g.getEndTime('yyyy-MM-dd')
        };
        this.fetchData(payload);
    },

    fixValue: function(v) {
        for (var i in v) {

            if (i == 'time' || i == 'starttime' || i == 'endtime' || i == 'BeginTime' || i == 'begintime' || i == 'worktime') {
                continue;
            }
            var f = parseFloat(v[i]);
            if (!isNaN(f))
            {
                v[i] = f;
            }

        }
        return v;
    },

    fillList: function(page) {
        console.log('fillList')
        var from = (page - 1) * this.PageCount;
        var to = (page) * this.PageCount;
        d = new Date()

        var value = null;
        var start = false;
        var count = 0;
        var params = this._dataListView.clearValues();

        var keys = Object.keys(this._dict);
        keys.sort().reverse();
        for (var i in keys) {

            // console.log(keys[i])
            if (count >= from) {
                start = true;
            }

            var key = keys[i];
            value = this._dict[key];
            if (value)
            {
                count += 1;
                if (start)
                {
                    value = this.fixValue(value)
                    this._dataListView.addValue(value, params);
                }
            }

            if (count > to)
                break;
        }
        this.updatePageBar(keys.length, page);
        return false;
    },

    fillList5min: function(page) {
        var from = (page - 1)* this.PageCount;
        var to = (page) * this.PageCount;
        d = new Date()

        console.log(from, to, page);
        var value = null;
        var start = false;
        var count = 0;
        var params = this._dataListView.clearValues();

        var keys = Object.keys(this._dict);
        keys.sort().reverse();
        var gv = null;
        for (var i in keys) {

            if (count >= from) {
                start = true;
            }



            var key = keys[i];
            var m = key.substr(15, 1);//找分钟的位置的数
            var s = key.substr(17, 2);//找秒数

            value = this._dict[key];

            if ((m == '5' || m == '0') && s == '00') {
                if (gv) {
                    count++;
                    if (start)
                    {
                        this._dataListView.addValue(gv.getValue(), params);
                    }
                }

                if (value['start'] != null) {
                    var startTime = value['starttime'];
                    var endTime = value['endtime'];
                    gv = new GroupValue({'time': key, 'startTime': startTime, 'endtime': endTime});
                } else  {
                    gv = new GroupValue({'time': key});
                }
            }

            gv && gv.addValue(value);

            if (count > to) {
                console.log('Break!')
                break;
            }
        }

        console.log(keys.length / 10)
        this.updatePageBar(keys.length / 10, page)
    },

    fillList1Hour: function() {

        var value = null;
        var start = false;
        var count = 0;
        var params = this._dataListView.clearValues();

        var keys = Object.keys(this._dict);
        keys.sort().reverse();
        var gv = null;
        for (var i in keys) {


            var key = keys[i];
            var m = key.substr(14, 2);
            var s = key.substr(17, 2);

            if (m == '00' && s == '00') {
                if (gv) {
                    count++;

                    this._dataListView.addValue(gv.getValue(), params);
                    gv.clearValues();
                }

                gv = new GroupValue({'time': key});
            }

            value = this._dict[key];
            gv && gv.addValue(value);
        }

        // Try
        if (gv) {
            this._dataListView.addValue(gv.getValue(), params);
        }

        this.updatePageBar(0, 0)
    },

    fillList1Day: function(page) {

        var value = null;
        var from = (page - 1)* this.PageCount;
        var to = (page) * this.PageCount;
        var start = false;
        var count = 0;
        var params = this._dataListView.clearValues();

        var keys = Object.keys(this._dict);

        keys.sort().reverse();
        var gv = null;
        for (var i in keys) {

            var key = keys[i];
            var h = key.substr(11, 2);
            var m = key.substr(14, 2);
            var s = key.substr(17, 2);

            if (h == '00' && m == '00' && s == '00')
            {
                if (gv)
                {
                    var v = gv.getValue();
                    v['time'] = key.substr(0, 10);
                    this._dataListView.addValue(v, params);
                }
            }
            else
            {
                if (!gv)
                {
                    gv = new GroupValue({'time': key});

                }
                value = this._dict[key];
                gv.addValue(value);
            }
        }

        this.updatePageBar(0, 0)
    },

    dateRangeChanged: function(range) {
        var payload = {
            start: range.start.toString('yyyy-MM-dd'),
            end: range.end.toString('yyyy-MM-dd')
        };

        this._today = false;
        if (range.start.toString('yyyy-MM-dd') == Date.today().toString('yyyy-MM-dd'))
        {
            this._today = true;
        }
        this.fetchData(payload);
    },

    makeDataDict: function(items) {
        var dict = [];
        for (var i in items) {
            var item = items[i];
            var t = item['time'];
            dict[t] = item;
        }
        this._dict = dict;
        return this._dict;
    },

    postOnTabChanged: function(tabItem) {
        this._onChartsPage = false;

        if (tabItem.hasClass('history')) {
            this.onDataStatisitcTabShown();
        } else if (tabItem.hasClass('charts')) {
            this._onChartsPage = true;
            this.updateIntervalButtons1(this._chartInterval);
            this.updateIntervalButtons2(this._chartInterval);
            this.showChartsTab && this.showChartsTab();
        } else if (tabItem.hasClass('data')) {
            this.updateIntervalButtons1(this._chartInterval);
            this.updateIntervalButtons2(this._chartInterval);
            this.onShow();
        } else if (tabItem.hasClass('alerts')) {
            // this.onAlertPageShow();
        } else if (tabItem.hasClass('summary')) {
            this.onSummaryShow();
        } else if (tabItem.hasClass('settings')) {
            this.onSettingPageShow();
        }

        // Device
        this.onTabChanged && this.onTabChanged(tabItem);
    },

    chartFilterData: function(data, field, interval, step) {

        var datas = [];
        var dict = [];
        var endTime = g.getEndTime().getTime();
        var beginTime = g.getBeginTime().getTime();

        step = step || 30 * 1000;
        var count = interval / step;

        // Store data in a dict
        var item = null;
        for (var i in data) {
            item = data[i];
            var t = Date.parse(item['time']).getTime();
            dict[t] = item[field];
        }

        var counter = 0;
        var gv = new AverageValue();
        console.log("Count", count);
        if (count == 1)
        {
            for (var i = beginTime; i <= endTime; i += step)
            {
                datas.push( dict[i] );
            }
        }
        else
        {
            for (var i = beginTime; i <= endTime; i += step)
            {
                //
                if (counter == count) {
                    counter = 0;

                    datas.push( gv.getValue() );
                    gv.clearValues();
                }

                counter += 1;
                gv.addValue(dict[i]);
            }
        }


        return {'data': datas};
    },

    onAlertPageShow: function() {
        console.log("onAlertPageShow")
        if (!this._noAlertData)
        {
            this.fetchAlerts();
        }
    },

    onDataStatisitcTabShown: function() {
        if (!this._calendarPane) {
            this._calendarPane = new HistoryPane(this._deviceType);
            var r = this._calendarPane.create();
            r.appendTo(this._domNode.find("div.calendar-container"));

        }
    },


    fillSummaryList: function(page, dict, listView)
    {

        var from = (page - 1) * 50;
        var to = (page) * 50;

        var start = false;
        var count = 0;
        var params = listView.clearValues();

        var keys = Object.keys(dict);
        keys.sort().reverse();
        // console.log(keys.length, page, from, to)
        for (var i in keys) {

            if (count >= from) {
                start = true;
            }

            var key = keys[i];
            value = dict[key];
            if (value)
            {
                count += 1;
                if (start)
                {
                    // console.log(count)
                    value = this.fixValue(value)
                    listView.addValue(value, params);
                }
            }

            if (count > to)
                break;
        }

        this.updateSumPageBar(keys.length, page);
        return false;
    },

    updateSumPageBar: function(itemsCount, page) {

        var pageBarContainer = this._domNode.find('div.pagebar2');
        pageBarContainer.empty();

        if (this._sumPageBar)
        {
            this.unbindEvent(this, this.getPageEvent());
        }

        this._sumPageBar = new Pagebar({pageCount: Math.floor(itemsCount / 50) + 1, page: page});
        this._sumPageBar.create().appendTo(pageBarContainer);
        this._sumPageBar.setPageEvent(this, this.getPageEvent());
        var this_ = this;
        this.bindEvent(this, this.getPageEvent(), function(e, sender, data){

            this_.onChangeSumPage && this_.onChangeSumPage(data);
        });

        // this.decorateList && this.decorateList();
        return false;
    },

    onExport: function(btn) {
        var currentStationId = g.getCurrentStationId();
        if (currentStationId)
        {
            var api = "data/download/" + currentStationId + "/" + this._deviceType;

            var payload = {
                start: g.getBeginTime('yyyy-MM-dd'),
                end: g.getEndTime('yyyy-MM-dd')
            };

            if (btn.hasClass('exp_m5'))
            {
                payload['interval'] = 300;
            }
            else if(btn.hasClass('exp_h1')){
                payload['interval'] = 3600;
            }
            else if (btn.hasClass('exp_d1'))
            {
                payload['interval'] = 3600 * 24;
            }

            $.download(api, payload, 'POST');
        }


    },

    // ====================================================================
    // Config settings
    onSettingPageShow: function() {
        this.fetchAlertSettingValues(this._deviceType);
    },

    fetchAlertSettingValues: function(device)
    {
        console.log('fetch', device, 'alert-settings');
        var url = "alert/get/" + g.getCurrentStationId() + "/" + device;
        var this_ = this;
        this.ajax(url, null, function(data)
        {
            var d = eval('(' + data + ')');
            console.log(data);
            if (d['errorCode'] == 0)
            {
                var values = d['results']['values'];

                var domNode = this_._domNode.find('.tab-pane.config div');
                this_.fillAlertSettingList(domNode, values);

            }
        });
    },

    fillAlertSettingList: function (domNode, values) {
        domNode.empty();

        this._settingsListView = new ListView();
        var dataListViewDomNode = this._settingsListView.create();
        dataListViewDomNode.appendTo(domNode);

        this._settingsListView.setHeaders([
            {'key':'id', 'type': 'id'},
            {'key':'name', 'name':'报警字段名称'},
            {'key':'field', 'name':'报警字段', css:'field' },
            {'key':'value', 'name':'报警值', type: 'input', css:'list-input'},
            {'key':'operator', 'name':'操作', type: 'button', bind: 'id'}
        ]);

        for (var i in values)
        {
            var n = 1;

            var d = (values[i]);
            if (d['config']['name'].indexOf('-') > 0)
                n = 2;

            if (d['config']['level'] == 2)
            {
                var v1 = (!!d['value']['v1']) ? d['value']['v1'] : '未设置';
                var v2 = (!!d['value']['v2']) ? d['value']['v2'] : '未设置';

                var item1 = {
                    'field': i,
                    'name': d['config']['name'] + '(一级报警)',
                    'value': parseFloat(v1).toFixed(n),
                    'operator': '修改'
                };
                var entry = this._settingsListView.addEntry(item1);
                entry.addClass('serious');

                var item2 = {
                    'field': i,
                    'name': d['config']['name'] + '(二级报警)',
                    'value': parseFloat(v2).toFixed(n),
                    'operator': '修改'
                };
                this._settingsListView.addEntry(item2);

            }
            else
            {
                var v2 = (!!d['value']['v2']) ? d['value']['v2'] : '未设置';
                var item1 = {
                    'field': i,
                    'name': d['config']['name'] + '(二级报警)',
                    'value': parseFloat(v2).toFixed(n),
                    'operator': '修改'
                };
                this._settingsListView.addEntry(item1);
            }
        }

        var this_ = this;
        dataListViewDomNode.delegate('a', 'click', function(a){
            var tr = $(a.target).parent().parent();
            var fieldName = tr.find('td.field').text();
            var fieldValue = tr.find('td.list-input input').val();
            console.log(fieldName, fieldValue);

            var level = tr.hasClass('serious') ? 1 : 2;
            this_.ajax('alert/set/' + g.getCurrentStationId() + '/' + this_._deviceType, {
                f: fieldName, v: fieldValue, l: level
            }, function(data){
                var d = eval('(' + data + ')');
                if (d['errorCode'] == 0)
                    alert('修改成功');
            });
        })

    },

    updateAlertPageBar: function(itemsCount, page) {

        var pageBarContainer = this._domNode.find('div.alert-pane-page');
        pageBarContainer.empty();
        if (this._pageBar)
        {
            this.unbindEvent(this, this.getAlertPageEvent());
        }

        if (page == 0)
        {
            console.log('page is 0!')
            return;
        }

        this._pageBar = new Pagebar({pageCount: Math.floor(itemsCount / this.AlertPageCount), page: page});
        this._pageBar.create().appendTo(pageBarContainer);
        this._pageBar.setPageEvent(this, this.getAlertPageEvent());
        var this_ = this;
        this.bindEvent(this, this.getAlertPageEvent(), function(e, sender, data){

            var level = this_._domNode.find('.alert-select').val();
            console.log('Page:', data, 'level:', level);
            this_.fetchAlerts(level, data);
        });

        return false;
    }


});





