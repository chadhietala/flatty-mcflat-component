import { moduleForComponent, test } from 'ember-qunit';
import hbs from 'htmlbars-inline-precompile';

moduleForComponent('flat-bizz', 'Integration | Component | flat bizz', {
  integration: true
});

test('it renders', function(assert) {
  // Set any properties with this.set('myProperty', 'value');
  // Handle any actions with this.on('myAction', function(val) { ... });"

  this.render(hbs`{{flat-bizz}}`);

  assert.equal(this.$().text().trim(), '');

  // Template block usage:"
  this.render(hbs`
    {{#flat-bizz}}
      template block text
    {{/flat-bizz}}
  `);

  assert.equal(this.$().text().trim(), 'template block text');
});
