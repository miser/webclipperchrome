var MKEvent = function() {};
_.extend(MKEvent.prototype, Backbone.Events);
MKEvent.prototype.setState = function() {
	this.trigger('changeState', arguments[0], [].slice.call(arguments, 1));
}