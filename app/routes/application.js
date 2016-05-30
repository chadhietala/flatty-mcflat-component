import Ember from 'ember';

function data() {
  let items = new Array(100);
  for (let i = 0; i < 100; i++) {
    items[i] = { id: i, name: i % 2 ? 'Kris' : 'Chad' };
  }

  return items;
}

export default Ember.Route.extend({
  model() {
    return data();
  }
});
