/*
 * Copyright (C) 2001-2011 Food and Agriculture Organization of the
 * United Nations (FAO-UN), United Nations World Food Programme (WFP)
 * and United Nations Environment Programme (UNEP)
 * 
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or (at
 * your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * General Public License for more details.
 * 
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software
 * Foundation, Inc., 51 Franklin St, Fifth Floor, Boston, MA 02110-1301, USA
 * 
 * Contact: Jeroen Ticheler - FAO - Viale delle Terme di Caracalla 2,
 * Rome - Italy. email: geonetwork@osgeo.org
 */
Ext.namespace('GeoNetwork.view');

/** api: (define)
 *  module = GeoNetwork.view
 *  class = ViewWindow
 *  base_link = `Ext.Panel <http://extjs.com/deploy/dev/docs/?class=Ext.Panel>`_
 */
/** api: constructor 
 *  .. class:: ViewWindow(config)
 *
 *     Create a GeoNetwork metadata view window
 *     to display a metadata record. The metadata view use the view service.
 *     
 *     A toolbar is provided with:
 *      
 *      * a view mode selector 
 *      * a metadata menu (:class:`GeoNetwork.MetadataMenu`)
 *      * a print mode menu (for pretty HTML printing)
 *      * a menu to turn off tooltips (on metadata descriptors)
 *
 */
GeoNetwork.view.ViewWindow = Ext.extend(Ext.Window, {
    defaultConfig: {
        layout: 'fit',
        width: 700,
        height: 740,
        border: false,
        /** api: config[lang] 
         *  The language to use to call GeoNetwork services in the print mode (which is opened in a new window).
         */
        lang: 'en',
        autoScroll: true,
        closeAction: 'destroy',
        /** api: config[currTab] 
         *  The default view mode to use. Default is 'simple'.
         */
        currTab: 'simple',
        /** api: config[displayTooltip] 
         *  Display tooltips or not. Default is true.
         */
        displayTooltip: true,
        /** api: config[printDefaultForTabs]
         *  Define if default mode should be used for HTML print output instead of tabs
         *  (eg. metadata tag in advanced view will be replaced by default view)
         */
        printDefaultForTabs: false,
        printMode: undefined,
        /** api: config[relationTypes] 
         *  List of types of relation to be displayed in header. 
         *  Do not display feature catalogues (gmd:contentInfo) and sources (gmd:lineage) by default. 
         *  Set to '' to display all.
         */
        relationTypes: 'service|children|related|parent|dataset',
        maximizable: true,
        maximized: false,
        collapsible: true,
        collapsed: false
    },
    serviceUrl: undefined,
    catalogue: undefined,
    metadataUuid: undefined,
    record: undefined,
    resultsView: undefined,
    actionMenu: undefined,
    tipTpl: undefined,
    metadataSchema: undefined,
    cache: {},
    tooltips: [],
    /** api: method[getLinkedData]
     *  Get related metadata records for current metadata using xml.relation service.
     */
    getLinkedData : function() {
        var store = new GeoNetwork.data.MetadataRelationStore(this.catalogue.services.mdRelation + '?type=' + this.relationTypes + '&fast=false&uuid=' + this.metadataUuid, null, true),
            view = this;
        store.load();
        store.on('load', function(){
            this.each(view.displayLinkedData, view);
        });
    },
    /** private: method[displayLinkedData]
     *  Display the record in the metadata related table (only available in simple view mode).
     */
    displayLinkedData: function(record){
        var table = Ext.query('table.related', this.body.dom),
            type = record.get('type');
        var el = Ext.get(table[0]);
        var exist = el.child('tr td[class*=' + type + ']');
        var link = '<li><a href="#" onclick="javascript:catalogue.metadataShow(\'' + 
            record.get('uuid') + '\');return false;" ' + 
            'title="' + record.get('abstract') + '">' + 
            record.get('title') + '</a></li>';
        if (exist !== null) {
            exist.next().child('li').insertHtml('afterEnd', link);
        } else {
            el.child('tr').insertHtml('beforeBegin', '<tr><td class="main ' + type + '"><span class="cat-' + type +' icon">' + OpenLayers.i18n('related' + type) + '</span></td>' + 
            '<td><ul>' + link + '</ul></td></tr>');
        }
    },
    createActionMenu: function(){
        if (!this.actionMenu) {
        
            this.actionMenu = new GeoNetwork.MetadataMenu({
                catalogue: this.catalogue,
                record: this.record,
                resultsView: this.resultsView
            });
        }
        
        var actionButton = {
            text: OpenLayers.i18n('mdMenu'),
            menu: this.actionMenu
        };
        return actionButton;
    },
    // TODO : duplicate from EditorToolBar - start
    createViewMenu: function(modes){
        var items = ['<b class="menu-title">' + OpenLayers.i18n('chooseAView') + '</b>'];
        
        this.viewMenu = new Ext.menu.Menu({
            items: items
        });
        
        var viewButton = {
            text: OpenLayers.i18n('viewMode'),
            iconCls: 'viewModeIcon',
            menu: this.viewMenu
        };
        
        return viewButton;
    },
    updateViewMenu: function(){
        var modes = Ext.query('span.mode', this.body.dom), menu = [], i, j, e, cmpId = this.getId(), isSimpleModeActive = true;
        menu.push([OpenLayers.i18n('simpleViewMode'), 'view-simple', isSimpleModeActive]);
        Ext.ux.Lightbox.register('a[rel^=lightbox-viewset]', true);
        
        this.printMode = this.currTab;
        
        for (i = 0; i < modes.length; i++) {
            if (modes[i].firstChild) {
                var id = modes[i].getAttribute('id');
                var label = modes[i].innerHTML;
                var next = Ext.get(modes[i]).next();
                var tabs = next.query('LI');
                var current = next.query('LI[id=' + this.currTab + ']');
                var activeMode = current.length === 1;
                
                // Remove mode and children tabs if not in current mode
                if (!activeMode) {
                    Ext.get(modes[i]).parent().remove();
                } else {
                    // Remove tab if only one tab in that mode
                    if (next && tabs.length === 1) {
                        next.remove();
                    } else {
                        // Register events when multiple tabs
                        for (j = 0; j < tabs.length; j++) {
                            e = Ext.get(tabs[j]);
                            if (this.printDefaultForTabs) {
                            	this.printMode = 'default';
                            }
                            e.on('click', function(){
                                Ext.getCmp(cmpId).switchToTab(this);
                            }, e.getAttribute('id'));
                        }
                    }
                }
                menu.push([label, id, activeMode]);
                
                if (activeMode === true) {
                    isSimpleModeActive = false;
                }
            }
        }
        
        // If another mode is active turn off simple mode.
        menu[0][2] = isSimpleModeActive;
        this.updateToolbar(menu);
    },
    updateToolbar: function(modes){
        var i, m;
        this.viewMenu.removeAll();
        for (i = 0; i < modes.length; i++) {
            m = modes[i];
            this.viewMenu.add({
                text: m[0],
                checked: false,
                disabled: m[2], // Disable current mode
                group: 'mode',
                value: m[1],
                listeners: {
                    'checkchange': this.onViewCheck,
                    scope: this // FIXME : this needs to be editor
                }
            });
        }
        this.viewMenu.doLayout();
    },
    switchToTab: function(tab){
        this.currTab = tab;
        this.onViewCheck({
            value: this.currTab
        }, true);
    },
    onViewCheck: function(item, checked){
        if (checked) {
            this.currTab = item.value;
            this.load({
                url: this.serviceUrl + '&currTab=' + this.currTab,
                callback: this.afterMetadataLoad,
                scope: this
            });
        }
    },
    // TODO : duplicate from EditorToolBar - end
    afterMetadataLoad: function(){
        // Clear tooltip cache
        this.cache = {};
        this.tooltips = [];
        
        // Processing after content load
        this.updateViewMenu();
        
        // Create map panel for extent visualization
        this.catalogue.extentMap.initMapDiv();
        
        // Related metadata are only displayed in view mode with no tabs
        if (this.currTab === 'view-simple' || this.currTab === 'inspire' || this.currTab === 'simple') {
            this.getLinkedData();
        }
        
        this.registerTooltip();
    },
    createPrintMenu: function(){
        return new Ext.Button({
            iconCls: 'print',
            tooltip: OpenLayers.i18n('printTT'),
            listeners: {
                click: function(c, pressed){
                	window.open('print.html?uuid=' + this.metadataUuid + '&currTab=' + this.printMode + "&hl=" + this.lang);
                },
                scope: this
            }
        });
    },
    createTooltipMenu: function(){
        return new Ext.Button({
            enableToggle: true,
            pressed: this.displayTooltip,
            iconCls: 'book',
            tooltip: OpenLayers.i18n('enableTooltip'),
            listeners: {
                toggle: function(c, pressed){
                    this.displayTooltip = pressed;
                    this.enableTooltip();
                },
                scope: this
            }
        });
    },
    /**
     * Look for all th element with an id and register
     * a tooltip
     */
    enableTooltip: function(){
        Ext.each(this.tooltips, function(item, idx){
            if (this.displayTooltip) {
                item.enable();
            } else {
                item.disable();
            }
        }, this);
    },
    /**
     * Look for all th element with an id and register
     * a tooltip
     */
    registerTooltip: function(){
        var formElements = Ext.query('th[id]', this.body.dom);
        formElements = formElements.concat(Ext.query('legend[id]', this.body.dom));
        Ext.each(formElements, function(item, index, allItems){
            var e = Ext.get(item);
            var id = e.getAttribute('id');
            if (e.is('TH')) {
                var section = e.up('FIELDSET');
                var f = function(){
                    if (this.displayTooltip) {
                        this.loadHelp(id, section);
                    }
                };
                e.parent().on('mouseover', f, this);
                
            } else {
                var f = function(){
                    if (this.displayTooltip) {
                        this.loadHelp(id);
                    }
                };
                    e.on('mouseover', f, this);
                
            }
        }, this);
    },
    /**
     * Add a tooltip to an element. If sectionId is defined,
     * then anchor is on top (usually is a fieldset legend element)
     */
    loadHelp: function(id, sectionId){
        if (!this.cache[id]) {
            var panel = this;
            GeoNetwork.util.HelpTools.get(id, this.metadataSchema, this.catalogue.services.schemaInfo, function(r) {
                panel.cache[id] = panel.tipTpl.apply(r.records[0].data);
                    
                var t = new Ext.ToolTip({
                    target: id,
                    title: r.records[0].get('label'),
                    anchor: sectionId ? 'top' : 'bottom',
                    anchorOffset: 35,
                    html: panel.cache[id]
                });
                // t.show();// This force the tooltip to be displayed once created
                // it may cause issue when user scroll, so tooltips are all dislayed for hovered element
                // If not present, the tooltip only appear when user come back to the element. FIXME
                panel.tooltips.push(t);
            });
        }
    },
    /** private: method[initComponent] 
     *  Initializes the metadata view window.
     */
    initComponent: function(){
        Ext.applyIf(this, this.defaultConfig);
        
        this.tipTpl = new Ext.XTemplate(GeoNetwork.util.HelpTools.Templates.SIMPLE);
        
        this.tools = [{
            id: 'newwindow',
            qtip: OpenLayers.i18n('newWindow'),
            handler: function(e, toolEl, panel, tc){
                window.open(GeoNetwork.Util.getBaseUrl(location.href) + "#uuid=" + this.metadataUuid);
                this.hide();
            },
            scope: this
        }];
        this.tbar = [this.createViewMenu(), this.createActionMenu(), '->', this.createPrintMenu(), this.createTooltipMenu()];
        
        GeoNetwork.view.ViewWindow.superclass.initComponent.call(this);
        this.metadataSchema = this.record ? this.record.get('schema') : '';
        this.setTitle(this.record ? this.record.get('title') : '');
        this.add(new Ext.Panel({
            autoLoad: {
                url: this.serviceUrl + '&currTab=' + this.currTab,
                callback: this.afterMetadataLoad,
                scope: this
            },
            border: false,
            frame: false,
            autoScroll: true
        }));
        
        this.on('beforeshow', function(el) {
            el.setSize(
                el.getWidth() > Ext.getBody().getWidth() ? Ext.getBody().getWidth() : el.getWidth(),
                el.getHeight() > Ext.getBody().getHeight() ? Ext.getBody().getHeight() : el.getHeight()); 
        });
    }
});

/** api: xtype = gn_view_viewwindow */
Ext.reg('gn_view_viewwindow', GeoNetwork.view.ViewWindow);