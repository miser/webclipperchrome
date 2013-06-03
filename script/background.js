//@huntbao @mknote
//All right reserved
//Notice: chrome version below 20 will not work for this extension
//(since it has no chrome.extension.sendMessage method and Blob() constructor is illegal and etc.)
(function($) {
    'use strict';
    var chromeSchemeReg = /chrome:\/\/.*/ig;
    window.maikuNote = {
        init: function() {
            var self = this;
            self.jQuerySetUp();
            self.browserAction();
            self.initManagement();
            self.initExtensionConnect();
            self.initTabEvents();
            self.initExtensionRequest();
            self.showExtensionGuide();
            //self.removeFileSystems();
            //self.initOmnibox();
        },
        browserAction: function() {
            var self = this;
            chrome.browserAction.onClicked.addListener(function(tab) {
                if (!chrome.extension.sendMessage) {
                    ReadyErrorNotify.show('BrowserTooLower', 30000);
                    return;
                }
                var match = tab.url.match(/^(.*?):/),
                    scheme = match[1].toLowerCase();
                if (chromeSchemeReg.test(tab.url) || (scheme != "http" && scheme != "https")) {
                    ReadyErrorNotify.show('notClipPageInfo');
                    return;
                }
                self.createPopup();
            });
        },
        createPopup: function() {
            chrome.tabs.executeScript(null, {
                code: "try{maikuClipper.createPopup();}catch(e){console.log(e);var port = chrome.extension.connect({name: 'maikuclipperisnotready'});port.postMessage();}"
            });
        },
        closePopup: function() {
            chrome.tabs.executeScript(null, {
                code: "maikuClipper.closePopup();"
            });
        },
        initContextMenus: function(beforeCreate) {
            var self = this;
            if (!chrome.extension.sendMessage) {
                return;
            }
            if (self.isCreatingContextMenus) return;
            self.isCreatingContextMenus = true;
            chrome.contextMenus.removeAll(function() {
                self.createTopPriorityContextMenu();
                beforeCreate && beforeCreate();
                self.createNormalContextMenus();
            });
        },
        createTopPriorityContextMenu: function() {
            var self = this;
            chrome.contextMenus.create({
                contexts: ['selection'],
                title: chrome.i18n.getMessage("clipSelectionContextMenu"), //剪辑选择内容
                onclick: function(info, tab) {
                    chrome.tabs.executeScript(tab.id, {
                        code: "maikuClipper.getSelectedContent();"
                    });
                }
            });
        },
        createNormalContextMenus: function() {
            var self = this;
            chrome.contextMenus.create({
                contexts: ['image'],
                title: chrome.i18n.getMessage('clipImageContextMenu'),
                onclick: function(info, tab) {
                    var note = {
                        title: tab.title,
                        sourceurl: tab.url,
                        notecontent: '<img src="' + info.srcUrl + '" alt="' + tab.title + '" title="' + tab.title + '" />'
                    }
                    self.syncNote(note);
                }
            });
            chrome.contextMenus.create({
                contexts: ['link'],
                title: chrome.i18n.getMessage('clipLinkContextMenu'),
                onclick: function(info, tab) {
                    chrome.tabs.executeScript(tab.id, {
                        code: "maikuClipper.getLinkInfoByUrl('" + info.linkUrl + "');"
                    });
                }
            });
            chrome.contextMenus.create({
                contexts: ['page'],
                title: chrome.i18n.getMessage('clipPageContextMenu'),
                onclick: function(info, tab) {
                    chrome.tabs.executeScript(tab.id, {
                        code: "maikuClipper.getPageContent();"
                    });
                }
            });
            chrome.contextMenus.create({
                contexts: ['page'],
                title: chrome.i18n.getMessage('clipAllImageContextMenu'),
                onclick: function(info, tab) {
                    chrome.tabs.executeScript(tab.id, {
                        code: "maikuClipper.getAllImages();"
                    });
                }
            });
            chrome.contextMenus.create({
                contexts: ['page'],
                title: chrome.i18n.getMessage('clipAllLinkContextMenu'),
                onclick: function(info, tab) {
                    chrome.tabs.executeScript(tab.id, {
                        code: "maikuClipper.getAllLinks();"
                    });
                }
            });
            chrome.contextMenus.create({
                type: 'separator',
                contexts: ['all']
            });

            chrome.contextMenus.create({
                contexts: ['page'],
                title: chrome.i18n.getMessage('clipPageUrlContextMenu'),
                onclick: function(info, tab) {
                    var note = {
                        title: tab.title,
                        sourceurl: tab.url,
                        notecontent: '<img src="' + tab.favIconUrl + '" title="' + tab.title + '" alt="' + tab.title + '"/>' + '<a href="' + tab.url + '" title="' + tab.title + '">' + tab.url + '</a>'
                    }
                    self.syncNote(note);
                }
            });
            chrome.contextMenus.create({
                contexts: ['page'],
                title: chrome.i18n.getMessage('pageCaptureContextMenu'),
                onclick: function(info, tab) {
                    var note = {
                        title: tab.title,
                        sourceurl: tab.url,
                        notecontent: ''
                    }
                    self.syncNote(note, {
                        isSaveMHTML: true,
                        tab: tab
                    });
                }
            });

            chrome.contextMenus.create({
                type: 'separator',
                contexts: ['all']
            });
            chrome.contextMenus.create({
                title: chrome.i18n.getMessage("newNoteContextMenu"),
                contexts: ['all'],
                onclick: function(info, tab) {
                    self.createPopup();
                }
            });
            chrome.contextMenus.create({
                type: 'separator',
                contexts: ['all']
            });
            chrome.contextMenus.create({
                title: chrome.i18n.getMessage("RetrieveRemoteImg"),
                contexts: ['all'],
                type: 'checkbox',
                checked: maikuNoteOptions.serializeImg || false,
                onclick: function(info, tab) {
                    self.setMaikuOption('serializeImg', info.checked);
                }
            });
            self.isCreatingContextMenus = false;
        },
        insureLogin: function(callback) {
            var self = this;
            if (self.userData) {
                callback && callback();
            } else {
                NotifyTips.showPersistent('NotLogin');
                self.checkLogin(function() {
                    console.log('insureLogin');
                    callback && callback();
                });
            }
        },
        initExtensionConnect: function() {
            var self = this;
            chrome.extension.onConnect.addListener(function(port) {
                switch (port.name) {
                    case 'gethost':
                        self.gethostHandlerConnect(port);
                        break;
                    case 'savenotefrompopup':
                        self.savenotefrompopupHandler(port);
                        break;
                    case 'allimages':
                        self.allimagesHandlerConnect(port);
                        break;
                    case 'link':
                        self.linkHandlerConnect(port);
                        break;
                    case 'alllinks':
                        self.alllinksHandlerConnect(port);
                        break;
                    case 'getpagecontent':
                    case 'getselectedcontent':
                        self.getpagecontentConnect(port);
                        break;
                    case 'maikuclipperisready':
                        self.maikuclipperisreadyHandlerConnect(port);
                    case 'maikuclipperisnotready':
                        self.maikuclipperisnotreadyHandlerConnect(port);
                        break;
                    case 'actionfrompopupinspecotr':
                        self.actionfrompopupinspecotrHandler(port);
                        break;
                    case 'noarticlefrompage':
                        console.log('error noarticlefrompage');
                        self.noarticlefrompageHandler(port);
                        break;
                    default:
                        break;
                }
            });
        },
        gethostHandlerConnect: function(port) {
            var self = this;
            port.onMessage.addListener(function(data) {
                maikuNoteUtil.createParticularContextMenu(data.host);
            });
        },
        savenotefrompopupHandler: function(port) {
            var self = this;
            port.onMessage.addListener(function(msg) {
                var note = {
                    title: msg.title,
                    sourceurl: msg.sourceurl,
                    notecontent: msg.notecontent,
                    tags: msg.tags,
                    categoryid: msg.categoryid
                }
                self.syncNote(note);
            });
        },
        allimagesHandlerConnect: function(port) {
            var self = this;
            port.onMessage.addListener(function(msg) {
                var imgs = msg.imgs,
                    titles = msg.imgTitles,
                    content = '';
                for (var i = 0; i < imgs.length; i++) {
                    content += '<img src="' + imgs[i] + '" title="' + titles[i] + '" alt="' + titles[i] + '"><br />';
                }
                var note = {
                    title: msg.title,
                    sourceurl: msg.sourceurl,
                    notecontent: content
                }
                self.syncNote(note);
            });
        },
        linkHandlerConnect: function(port) {
            var self = this;
            port.onMessage.addListener(function(msg) {
                var content = '<a href="' + msg.linkUrl + '" title="' + msg.title + '">' + msg.text + '</a>';
                var note = {
                    title: msg.title,
                    sourceurl: msg.sourceurl,
                    notecontent: content
                }
                self.syncNote(note);
            });
        },
        alllinksHandlerConnect: function(port) {
            var self = this;
            port.onMessage.addListener(function(msg) {
                var content = '',
                    links = msg.links;
                for (var i = 0, l = links.length, link; i < l; i++) {
                    link = links[i];
                    content += '<a href="' + link.linkUrl + '" title="' + link.title + '">' + link.text + '</a><br />';
                }
                var note = {
                    title: msg.title,
                    sourceurl: msg.sourceurl,
                    notecontent: content
                }
                self.syncNote(note);
            });
        },
        getpagecontentConnect: function(port) {
            var self = this;
            port.onMessage.addListener(function(msg) {
                var note = {
                    title: msg.title,
                    sourceurl: msg.sourceurl,
                    notecontent: msg.content,
                    tags: msg.tags,
                    categoryid: msg.categoryid
                }
                self.syncNote(note);
            });
        },
        maikuclipperisreadyHandlerConnect: function(port) {
            var self = this;
            port.onMessage.addListener(function(msg) {
                ReadyErrorNotify.close();
            });
        },
        maikuclipperisnotreadyHandlerConnect: function(port) {
            var self = this;
            port.onMessage.addListener(function(data) {
                data = data || {};
                ReadyErrorNotify.show(data.key);
            });
        },
        actionfrompopupinspecotrHandler: function(port) {
            var self = this;
            port.onMessage.addListener(function(data) {
                //send to popup
                chrome.tabs.sendRequest(port.sender.tab.id, {
                    name: 'actionfrompopupinspecotr',
                    data: data
                });
            });
        },
        checkLogin: function(callback) {
            var self = this;
            self.getUser(function(user) {
                if (!user) {
                    chrome.windows.create({
                        url: self.baseUrl + "/login",
                        type: "popup",
                        height: 600,
                        width: 800,
                        left: 0,
                        top: 0
                    }, function(win) {
                        var tabId = win.tabs[0].id;
                        chrome.tabs.onUpdated.addListener(function HandlerConnect(id, info) {
                            if (info.status == 'loading' && id == tabId) {
                                self.getUser(function(user) {
                                    if (user) {
                                        chrome.tabs.onUpdated.removeListener(HandlerConnect);
                                        chrome.windows.remove(win.id, callback(user));
                                    }
                                });
                            }
                        });
                    });
                } else {
                    callback(user);
                }
            });
        },
        checkLogout: function(callback) {
            var self = this;
            chrome.cookies.get({
                url: self.baseUrl,
                name: ".iNoteAuth"
            }, function(cookie) {
                if (cookie) {
                    chrome.windows.create({
                        url: self.baseUrl + "/account/logout",
                        type: "panel"
                    }, function(win) {
                        var tabId = win.tabs[0].id;
                        chrome.tabs.onUpdated.addListener(function HandlerConnect(id, info) {
                            if (info.status == 'loading' && id == tabId) {
                                chrome.cookies.get({
                                    url: self.baseUrl,
                                    name: ".iNoteAuth"
                                }, function(cookie) {
                                    if (!cookie) {
                                        self.userData = null;
                                        chrome.tabs.onUpdated.removeListener(HandlerConnect);
                                        chrome.windows.remove(win.id, callback);
                                    }
                                });
                            }
                        });
                    });
                } else {
                    callback();
                }
            });
        },
        initManagement: function() {
            // uninstall old version
            chrome.management.getAll(function(exs) {
                for (var i = exs.length - 1; i > 0; i--) {
                    if (exs[i].id == "mfhkadpfndbefbpibomdbdbnnpmjiaoh") {
                        chrome.management.uninstall("mfhkadpfndbefbpibomdbdbnnpmjiaoh");
                    }
                    if (exs[i].id == "blabbhjfbhclflhnbbapahfkhpcmgeoh") {
                        chrome.management.uninstall("blabbhjfbhclflhnbbapahfkhpcmgeoh");
                    }
                }
            });
        },
        getTitleByText: function(txt) {
            //todo
            var self = this,
                finalTitle = '';
            if (txt.length <= 100) return txt;
            if (txt.length > 0) {
                var t = txt.substr(0, 100),
                    l = t.length,
                    i = l - 1,
                    hasSpecialChar = false;
                //9 : HT 
                //10 : LF 
                //44 : ,
                //65292 : ，
                //46 :　．
                //12290 : 。
                //59 : ;
                //65307 : ；
                while (i >= 0) {
                    if (/^(9|10|44|65292|46|12290|59|65307)$/.test(t.charCodeAt(i))) {
                        hasSpecialChar = true;
                        break;
                    } else {
                        i--;
                    }
                }
                hasSpecialChar ? (t = t.substr(0, i)) : '';
                i = 0;
                l = t.length;
                while (i < l) {
                    if (/^(9|10)$/.test(t.charCodeAt(i))) {
                        break;
                    } else {
                        finalTitle += t.charAt(i);
                        i++;
                    }
                }
            }
            finalTitle = finalTitle.trim();
            return finalTitle.length > 0 ? finalTitle : '[未命名笔记]';
        },
        jQuerySetUp: function() {
            $.ajaxSetup({
                dataType: 'text',
                cache: false,
                dataFilter: function(data) {
                    data = $.parseJSON(data.substr(9)); //remove 'while(1);'
                    return data.success ? data.data : {
                        error: data.error
                    };
                },
                beforeSend: function(xhr) {
                    xhr.setRequestHeader('UserClient', 'inote_web_chromeext/3.1.0');
                }
            });
        },
        initTabEvents: function() {
            var self = this;
            chrome.tabs.onActivated.addListener(function(info, tab) {
                ReadyErrorNotify.close();
            });
            chrome.tabs.onUpdated.addListener(function(id, info, tab) {
                if (chromeSchemeReg.test(tab.url)) {
                    return;
                }
                if (info.status == 'loading') {
                    maikuNoteUtil.createParticularContextMenu(tab.url.split('/')[2]);
                }
                if (info.status == 'complete') {
                    //maybe login, maybe logout, update user data
                    //listen any page, since user can login from any page, not just http://note.sdo.com or http://passport.note.sdo.com
                    chrome.cookies.get({
                        url: self.baseUrl,
                        name: '.iNoteAuth'
                    }, function(cookie) {
                        if (cookie) {
                            if (!self.userData) {
                                self.getUser(function() {});
                            }
                        } else {
                            self.userData = null;
                        }
                    });

                    chrome.tabs.executeScript(null, {
                        code: "maikuClipper.getHost();"
                    });
                }
            });
        },
        initExtensionRequest: function() {
            var self = this;
            chrome.extension.onRequest.addListener(function(request, sender) {
                if (!sender || sender.id !== chrome.i18n.getMessage("@@extension_id")) return;
                switch (request.name) {
                    case 'getuser':
                        self.getuserHandlerRequest(sender, request.refresh);
                        break;
                    case 'popuplogin':
                        self.checkLogin(function(user) {
                            chrome.tabs.sendRequest(sender.tab.id, {
                                name: 'userlogined',
                                user: user,
                                settings: self.getSettings()
                            });
                        });
                        break;
                    case 'popuplogout':
                        self.checkLogout(function() {
                            chrome.tabs.sendRequest(sender.tab.id, {
                                name: 'userlogouted'
                            });
                        });
                        break;
                    case 'clicksavebtnwithoutloginpopup':
                        //popup, click save button, button user has not logined
                        console.log('clicksavebtnwithoutloginpopup');
                        self.checkLogin(function(user) {
                            chrome.tabs.sendRequest(sender.tab.id, {
                                name: 'clicksavebtnafteruserloginedpopup',
                                user: user,
                                settings: self.getSettings()
                            });
                        });
                    case 'setdefaultcategory':
                        //change category,store it
                        self.setMaikuOption('defaultCategory', request.defaultCategory);
                        break;
                    case 'setautoextract':
                        //change auto extract content option, store it
                        self.setMaikuOption('autoExtractContent', request.value);
                        break;
                    case 'createoptionstab':
                        chrome.tabs.create({
                            url: chrome.i18n.getMessage('helperUrl')
                        });
                        break;
                    default:
                        break;
                }
            });
        },
        getuserHandlerRequest: function(sender, refresh) {
            var self = this;
            if (refresh) {
                //user refresh infomation
                self.userData = null; //this will force to fetch newest info
            }
            self.getUser(function(user) {
                chrome.tabs.sendRequest(sender.tab.id, {
                    name: 'getuser',
                    user: user,
                    settings: self.getSettings(),
                    refresh: refresh
                });
            });
        },
        getUser: function(callback) {
            var self = this;
            if (self.userData) {
                callback(self.userData);
                return;
            }
            chrome.cookies.get({
                url: self.baseUrl,
                name: '.iNoteAuth'
            }, function(cookie) {
                if (cookie) {
                    //user is login, get user from localStorage or send request to get user
                    $.ajax({
                        url: self.baseUrl + '/plugin/clipperdata',
                        success: function(data) {
                            if (data.error) {
                                //todo
                                callback(cookie);
                                return;
                            }
                            self.userData = data;
                            callback(data);
                        },
                        error: function() {
                            callback(cookie);
                        }
                    });
                } else {
                    callback();
                }
            });
        },
        setMaikuOption: function(key, value) {
            var self = this;
            self[key] = value;
            maikuNoteOptions[key] = value;
        },
        getSettings: function() {
            var self = this;
            self.settings = {
                serializeImg: maikuNoteOptions.serializeImg,
                defaultCategory: maikuNoteOptions.defaultCategory,
                autoExtractContent: maikuNoteOptions.autoExtractContent
            }
            return self.settings;
        },
        removeFileSystems: function() {
            //every time browser booted, remove files
            chrome.browsingData.removeFileSystems({});
        },
        initOmnibox: function() {
            var self = this;
            chrome.omnibox.onInputEntered.addListener(function(text) {
                if (text == 'popup') {
                    self.createPopup();
                }
            });
        },
        showExtensionGuide: function() {
            var extensionguideUrl = this.baseUrl + '/public/extensionguide';

            function getVersion() {
                var details = chrome.app.getDetails();
                return details.version;
            }

            function onInstall() {
                chrome.tabs.create({
                    url: extensionguideUrl,
                    selected: true
                });
            }

            function onUpdate() {
                chrome.tabs.create({
                    url: extensionguideUrl,
                    selected: true
                });
                console.log("Extension Updated");
            }
            var currVersion = getVersion();
            var prevVersion = localStorage['version']
            if (currVersion != prevVersion) {
                if (typeof prevVersion == 'undefined') {
                    onInstall();
                } else {
                    onUpdate();
                }
                localStorage['version'] = currVersion;
            }
        },
        syncNote: function(note, option) {
            option = option || {};
            option.baseUrl = chrome.i18n.getMessage('baseUrl');
            var tags = note.tags || "";
            this.addTags(tags.split(','));
            MKSyncTaskQueue.add(new MKSyncTask(note, option));
        },
        addTags: function(noteTags) {
            function compareDifferent(ary1, ary2) {
                var differentAry = [],
                    ary2len = ary2.length - 1;
                for (var i = 0; i < ary1.length; i++) {
                    var compareValue = ary1[i];
                    if (!compareValue) continue;
                    for (var j = 0; j <= ary2len; j++) {
                        var val = ary2[j];
                        if (compareValue == val) {
                            break;
                        } else if (compareValue != val && j == ary2len) {
                            differentAry.push(compareValue)
                        }
                    }
                }
                return differentAry;
            }
            if (!this.userData) return;

            var newAddTags = compareDifferent(noteTags, this.userData.tags);
            this.userData.tags = this.userData.tags.concat(newAddTags)
        }
    };
    Object.defineProperties(maikuNote, {
        baseUrl: {
            value: chrome.i18n.getMessage('baseUrl'),
            writable: false
        }
    });
    $(function() {
        window.requestFileSystem = window.requestFileSystem || window.webkitRequestFileSystem;
        maikuNoteOptions = window.maikuNoteOptions;
        maikuNote.init();
    });

})(jQuery);