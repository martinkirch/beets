// Format times as minutes and seconds. Used by item-extra-detail-template
var timeFormat = function(secs) {
    if (secs == undefined || isNaN(secs)) {
        return '0:00';
    }
    secs = Math.round(secs);
    var mins = '' + Math.floor(secs / 60);
    secs = '' + (secs % 60);
    if (secs.length < 2) {
        secs = '0' + secs;
    }
    return mins + ':' + secs;
}

// Simple selection disable for jQuery.
// Cut-and-paste from:
// https://stackoverflow.com/questions/2700000
$.fn.disableSelection = function() {
    $(this).attr('unselectable', 'on')
           .css('-moz-user-select', 'none')
           .each(function() {
               this.onselectstart = function() { return false; };
            });
};

$(function() {

// Routes.
var BeetsRouter = Backbone.Router.extend({
    routes: {
        "item/query/:query": "itemQuery",
    },
    itemQuery: function(query) {
        var queryURL = query.split(/\s+/).map(encodeURIComponent).join('/');
        $.getJSON('item/query/' + queryURL, function(data) {
            var models = _.map(
                data['results'],
                function(d) { return new Item(d); }
            );
            var results = new Items(models);
            app.showItems(results);
        });
    }
});
var router = new BeetsRouter();

// Model.
var Item = Backbone.Model.extend({
    urlRoot: 'item'
});
var Items = Backbone.Collection.extend({
    model: Item
});

// Item views.
var ItemEntryView = Backbone.View.extend({
    tagName: "li",
    template: _.template($('#item-entry-template').html()),
    events: {
        'click': 'select',
        'click .remove': 'remove',
        'dblclick': 'play'
    },
    initialize: function() {
        this.playing = false;
    },
    render: function() {
        $(this.el).html(this.template(this.model.toJSON()));
        this.setPlaying(this.playing);
        return this;
    },
    remove: function(event) {
        event.stopPropagation();
        app.removeItem(this);
    },
    select: function() {
        app.selectItem(this);
    },
    play: function() {
        app.playItem(this.model);
    },
    setPlaying: function(val) {
        this.playing = val;
        if (val)
            this.$('.playing').show();
        else
            this.$('.playing').hide();
    }
});
//Holds Title, Artist, Album etc.
var ItemMainDetailView = Backbone.View.extend({
    tagName: "div",
    template: _.template($('#item-main-detail-template').html()),
    events: {
        'click .play': 'play',
    },
    render: function() {
        $(this.el).html(this.template(this.model.toJSON()));
        return this;
    },
    play: function() {
        app.playItem(this.model);
    }
});
// Holds Track no., Format, MusicBrainz link, Lyrics, Comments etc.
var ItemExtraDetailView = Backbone.View.extend({
    tagName: "div",
    template: _.template($('#item-extra-detail-template').html()),
    render: function() {
        $(this.el).html(this.template(this.model.toJSON()));
        return this;
    }
});
// Main app view.
var AppView = Backbone.View.extend({
    el: $('body'),
    events: {
        'submit #queryForm': 'querySubmit',
        'click #newest': 'queryNewest',
    },
    querySubmit: function(ev) {
        ev.preventDefault();
        router.navigate('item/query/' + encodeURIComponent($('#query').val()), true);
    },
    queryNewest: function(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        latestQuery = 'added:-1w..';
        router.navigate('item/query/' + encodeURIComponent(latestQuery), true);
        $('#query').val(latestQuery);
    },
    initialize: function() {
        this.playingItem = null;
        this.shownItems = null;

        // Not sure why these events won't bind automatically.
        this.$('audio').bind({
            'play': _.bind(this.audioPlay, this),
            'pause': _.bind(this.audioPause, this),
            'ended': _.bind(this.audioEnded, this)
        });
    },
    showItems: function(items) {
        var startAt = 0;
        if ($('#replaceItems').is(':checked')) {
            this.shownItems = items;
            $('#results').empty();
        } else {
            startAt = this.shownItems.size();
            items.forEach(item => {
                this.shownItems.add(item);
            });
        }
        this.shownItems.each(function(item, index) {
            if (index >= startAt) {
                var view = new ItemEntryView({model: item});
                item.entryView = view;
                $('#results').append(view.render().el);
            }
        });
    },
    removeItem: function(view) {
        this.shownItems.remove(view.model);
        $(view.el).remove();
    },
    dropItem: function(fromI, toI) {
        movedItem = this.shownItems.at(fromI);
        this.shownItems.remove(movedItem);
        this.shownItems.add(movedItem, {at: toI});
    },
    selectItem: function(view) {
        // Mark row as selected.
        $('#results li').removeClass("selected");
        $(view.el).addClass("selected");
        this.showItem(view.model)
    },
    playItem: function(item) {
        var url = 'item/' + item.get('id') + '/file';
        $('audio').attr('src', url);
        $('audio').get(0).play();

        if (this.playingItem != null) {
            this.playingItem.entryView.setPlaying(false);
        }
        item.entryView.setPlaying(true);
        this.showItem(item);
        this.playingItem = item;
    },
    showItem(item) {
        // Show main and extra detail.
        var mainDetailView = new ItemMainDetailView({model: item});
        $('#main-detail').empty().append(mainDetailView.render().el);

        var extraDetailView = new ItemExtraDetailView({model: item});
        $('#extra-detail').empty().append(extraDetailView.render().el);
    },
    audioPause: function() {
        this.playingItem.entryView.setPlaying(false);
    },
    audioPlay: function() {
        if (this.playingItem != null)
            this.playingItem.entryView.setPlaying(true);
    },
    audioEnded: function() {
        this.playingItem.entryView.setPlaying(false);

        // Try to play the next track.
        var idx = this.shownItems.indexOf(this.playingItem);
        if (idx == -1) {
            // Not in current list.
            return;
        }
        var nextIdx = idx + 1;
        if (nextIdx >= this.shownItems.size()) {
            // End of  list.
            return;
        }
        this.playItem(this.shownItems.at(nextIdx));
    }
});
var app = new AppView();

// App setup.
Backbone.history.start({pushState: false});

// Disable selection on UI elements.
$('#entities ul').disableSelection();
$('#header').disableSelection();

var sortable = Sortable.create(
    document.getElementById('results'),
    {
        onEnd: function(event){ app.dropItem(event.oldIndex, event.newIndex); },
    }
);

});
