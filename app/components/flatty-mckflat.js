import Ember from 'ember';
import jQuery from 'jquery';

let req = Ember.__loader.require;

const CoreView = req('ember-views/views/core_view').default;
const { getOwner, setOwner, OWNER } = req('container/owner');
const { get } = req('ember-metal/property_get');
const { set } = req('ember-metal/property_set');
const run = req('ember-metal/run_loop').default;
const { POST_INIT } = req('ember-runtime/system/core_object');
const { computed } = req('ember-metal/computed');
const { Mixin, NAME_KEY } = req('ember-metal/mixin');
const symbol = req('ember-metal/symbol').default;
const { guidFor } = req('ember-metal/utils');
const { MUTABLE_CELL } = req('ember-views/compat/attrs-proxy');

var EMPTY_ARRAY = [];
const INIT_WAS_CALLED = symbol('INIT_WAS_CALLED');

function validateAction(component, actionName) {
  if (actionName && actionName[MUTABLE_CELL]) {
    actionName = actionName.value;
  }
  return actionName;
}

export let HAS_BLOCK = symbol('HAS_BLOCK');

const Component = CoreView.extend({
  init() {
    this._super(...arguments);
    set(this, 'controller', this);
    set(this, 'context', this);

    if (!this.layout && this.layoutName && getOwner(this)) {
      let layoutName = get(this, 'layoutName');

      this.layout = this.templateForName(layoutName);
    }

    if (this.defaultLayout && !this.layout) {
      this.layout = this.defaultLayout;
    }


    /**
      Array of child views. You should never edit this array directly.
      Instead, use `appendChild` and `removeFromParent`.
      @property childViews
      @type Array
      @default []
      @private
    */
    this.childViews = [];
    this.parentView = null;
    this.ownerView = this.ownerView || this;
    this.classNames = this.classNames.slice();

    if (!this.elementId && this.tagName !== '') {
      this.elementId = guidFor(this);
    }

    this.scheduledRevalidation = false;

    this[INIT_WAS_CALLED] = true;
  },
  template: null,
  layoutName: null,
  layout: null,
  instrumentName: 'component',
  isView: true,
  templateName: null,
  element: null,
  elementId: null,
  tagName: null,
  isComponent: true,
  controller: null,
  context: null,
  target: null,
  action: null,
  actionContext: null,
  willInsertElement() {},
  didInsertElement() {},
  willClearRender() {},
  willDestroyElement() {},
  parentViewDidChange() {},
  targetObject: computed('controller', function() {
    if (this._targetObject) { return this._targetObject; }
    if (this._controller) { return this._controller; }
    var parentView = get(this, 'parentView');
    return parentView ? get(parentView, 'controller') : null;
  }),
  actionContextObject: computed(function() {
    var actionContext = get(this, 'actionContext');

    if (typeof actionContext === 'string') {
      var value = get(this, actionContext);
      if (value === undefined) { value = get(Ember.lookup, actionContext); }
      return value;
    } else {
      return actionContext;
    }
  }).property('actionContext'),
  triggerAction(opts = {}) {
    var action = opts.action || get(this, 'action');
    var target = opts.target || get(this, 'targetObject');
    var actionContext = opts.actionContext;

    function args(options, actionName) {
      var ret = [];
      if (actionName) { ret.push(actionName); }

      return ret.concat(options);
    }

    if (typeof actionContext === 'undefined') {
      actionContext = get(this, 'actionContextObject') || this;
    }

    if (target && action) {
      var ret;

      if (target.send) {
        ret = target.send.apply(target, args(actionContext, action));
      } else {
        ret = target[action].apply(target, args(actionContext));
      }

      if (ret !== false) {
        ret = true;
      }

      return ret;
    } else {
      return false;
    }
  },
  sendAction(action, ...contexts) {
    var actionName;

    // Send the default action
    if (action === undefined) {
      action = 'action';
    }
    actionName = get(this, `attrs.${action}`) || get(this, action);
    actionName = validateAction(this, actionName);

    // If no action name for that action could be found, just abort.
    if (actionName === undefined) { return; }

    if (typeof actionName === 'function') {
      actionName(...contexts);
    } else {
      this.triggerAction({
        action: actionName,
        actionContext: contexts
      });
    }
  },
  send(actionName, ...args) {
    var target;
    var action = this.actions && this.actions[actionName];

    if (action) {
      var shouldBubble = action.apply(this, args) === true;
      if (!shouldBubble) { return; }
    }

    if (target = get(this, 'target')) {
      target.send(...arguments);
    } else {
      if (!action) {
        throw new Error(' had no action handler for: ' + actionName);
      }
    }
  },
  [POST_INIT]() {
    this._super(...arguments);
    this.renderer.componentInitAttrs(this, this.attrs || {});
  },

  __defineNonEnumerable(property) {
    this[property.name] = property.descriptor.value;
  },

  revalidate() {
    this.renderer.revalidateTopLevelView(this);
    this.scheduledRevalidation = false;
  },

  scheduleRevalidate(node) {
    if (node && !this._dispatching && this.env.renderedNodes.has(node)) {
      run.scheduleOnce('render', this, this.revalidate);
      return;
    }

    if (!this.scheduledRevalidation || this._dispatching) {
      this.scheduledRevalidation = true;
      run.scheduleOnce('render', this, this.revalidate);
    }
  },
  removeFromParent() {
    var parent = this.parentView;

    // Remove DOM element from parent
    this.remove();

    if (parent) { parent.removeChild(this); }
    return this;
  },
  destroy() {
    // get parentView before calling super because it'll be destroyed
    var parentView = this.parentView;
    var viewName = this.viewName;

    if (!this._super(...arguments)) { return; }

    // remove from non-virtual parent view if viewName was specified
    if (viewName && parentView) {
      parentView.set(viewName, null);
    }

    // Destroy HTMLbars template
    if (this.lastResult) {
      this.lastResult.destroy();
    }

    return this;
  },
  handleEvent(eventName, evt) {
    return this._currentState.handleEvent(this, eventName, evt);
  },
  _register() {
    this._viewRegistry[this.elementId] = this;
  },
  _unregister() {
    delete this._viewRegistry[this.elementId];
  },
  readDOMAttr(name) {
    let attr = this._renderNode.childNodes.filter(node => node.attrName === name)[0];
    if (!attr) { return null; }
    return attr.getContent();
  },
  findElementInParentElement(parentElem) {
    var id = '#' + this.elementId;
    return jQuery(id)[0] || jQuery(id, parentElem)[0];
  },
  destroyElement() {
    return this._currentState.destroyElement(this);
  },
  createElement() {
    if (this.element) { return this; }

    this.renderer.createElement(this);

    return this;
  },
  forEachChildView(callback) {
    var childViews = this.childViews;

    if (!childViews) { return this; }

    var view, idx;

    for (idx = 0; idx < childViews.length; idx++) {
      view = childViews[idx];
      callback(view);
    }

    return this;
  },
  replaceIn(selector) {
    var target = jQuery(selector);
    this.renderer.replaceIn(this, target[0]);
    return this;
  },
  remove() {
    // What we should really do here is wait until the end of the run loop
    // to determine if the element has been re-appended to a different
    // element.
    // In the interim, we will just re-render if that happens. It is more
    // important than elements get garbage collected.
    if (!this.removedFromDOM) { this.destroyElement(); }

    // Set flag to avoid future renders
    this._willInsert = false;
  },
  renderToElement(tagName) {
    tagName = tagName || 'body';

    var element = this.renderer._dom.createElement(tagName);

    this.renderer.appendTo(this, element);
    return element;
  },
  rerender() {
    return this._currentState.rerender(this);
  },
  append() {
    return this.appendTo(document.body);
  },
  $(sel) {
    return this._currentState.$(this, sel);
  },

  nearestOfType(klass) {
    var view = get(this, 'parentView');
    var isOfType = klass instanceof Mixin ?
                   function(view) { return klass.detect(view); } :
                   function(view) { return klass.detect(view.constructor); };

    while (view) {
      if (isOfType(view)) { return view; }
      view = get(view, 'parentView');
    }
  },

  templateForName(name) {
    if (!name) { return; }

    let owner = getOwner(this);

    if (!owner) {
      throw new Error('Container was not found when looking up a views template. ' +
                 'This is most likely due to manually instantiating an Ember.View. ' +
                 'See: http://git.io/EKPpnA');
    }

    return owner.lookup('template:' + name);
  },

  concatenatedProperties: ['classNames', 'classNameBindings', 'attributeBindings'],

  attributeBindings: ['ariaRole:role'],

  ariaRole: null,

  classNames: EMPTY_ARRAY,

  classNameBindings: EMPTY_ARRAY,

  appendChild(view) {
    this.linkChild(view);
    this.childViews.push(view);
  },

  destroyChild(view) {
    view.destroy();
  },

  appendTo(selector) {
    let $ = this._environment ? this._environment.options.jQuery : jQuery;

    if ($) {
      let target = $(selector);

      this.renderer.appendTo(this, target[0]);
    } else {
      let target = selector;
      this.renderer.appendTo(this, target);
    }

    return this;
  },
  /**
    Removes the child view from the parent view.
    @method removeChild
    @param {Ember.View} view
    @return {Ember.View} receiver
    @private
  */
  removeChild(view) {
    // If we're destroying, the entire subtree will be
    // freed, and the DOM will be handled separately,
    // so no need to mess with childViews.
    if (this.isDestroying) { return; }

    // update parent node
    this.unlinkChild(view);

    // remove view from childViews array.
    let { childViews } = this;

    let index = childViews.indexOf(view);
    if (index !== -1) { childViews.splice(index, 1); }

    return this;
  },

  instrumentDisplay: computed(function() {
    if (this._debugContainerKey) {
      return '{{' + this._debugContainerKey.split(':')[1] + '}}';
    }
  }),

  instrumentDetails(hash) {
    hash.template = get(this, 'templateName');
    this._super(hash);
  },

  _transitionTo(state) {
    var priorState = this._currentState;
    var currentState = this._currentState = this._states[state];
    this._state = state;

    if (priorState && priorState.exit) { priorState.exit(this); }
    if (currentState.enter) { currentState.enter(this); }
  },

  linkChild(instance) {
    if (!instance[OWNER]) {
      setOwner(instance, getOwner(this));
    }

    instance.parentView = this;
    instance.ownerView = this.ownerView;
  },

  unlinkChild(instance) {
    instance.parentView = null;
  }
});

Component[NAME_KEY] = 'Ember.Component';

Component.reopenClass({
  isComponentFactory: true
});

export default Component;
