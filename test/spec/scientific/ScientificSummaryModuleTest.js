/* global afterEach, beforeEach, chai, describe, it, sinon */
'use strict';


var ScientificSummaryModule = require('scientific/ScientificSummaryModule');


var expect = chai.expect;


describe('scientific/ScientificSummaryModule', function () {
  describe('constructor', function () {
    it('is defined', function () {
      expect(typeof ScientificSummaryModule).to.equal('function');
    });

    it('can be instantiated', function () {
      expect(ScientificSummaryModule).to.not.throw(Error);
    });
  });

  describe('createRow', function () {
    var module;

    afterEach(function () {
      module.destroy();
    });

    beforeEach(function () {
      module = ScientificSummaryModule();
    });

    it('returns a row', function () {
      var row;

      row = module.createRow();

      expect(row.nodeName).to.equal('TR');
    });

    it('includes the preferred class if specified', function () {
      var row;

      row = module.createRow(true);

      expect(row.classList.contains('preferred')).to.equal(true);
    });

    it('skips the preferred class if not specified', function () {
      var row;

      row = module.createRow(false);

      expect(row.classList.contains('preferred')).to.equal(false);
    });
  });

  describe('createTable', function () {
    var module;

    afterEach(function () {
      module.destroy();
    });

    beforeEach(function () {
      module = ScientificSummaryModule();
    });

    it('does nothing if no products or labels are provided', function () {
      var container;

      // No products
      container = document.createElement('div');
      container.appendChild(module.createTable([], 'Foo', ['Label 1'],
          function () {}));

      expect(container.innerHTML).to.equal('');
      expect(container.childNodes.length).to.equal(0);

      // No labels
      container.appendChild(module.createTable([0], 'Foo', [],
          function () {}));

      expect(container.innerHTML).to.equal('');
      expect(container.childNodes.length).to.equal(0);
    });

    it('produces expected markup sections', function () {
      var container;

      container = document.createElement('div');
      container.appendChild(module.createTable([0, 1], 'Foo',
          ['Label 0', 'Label 1'], module.createRow));

      expect(container.querySelectorAll('h2').length)
          .to.equal(1);
      expect(container.querySelectorAll('.horizontal-scrolling').length)
          .to.equal(1);
      expect(container.querySelectorAll('div > .table-summary').length)
          .to.equal(1);
      expect(container.querySelectorAll('tbody > tr').length).to.equal(2);
    });

    it('executes the callback formatter', function () {
      var spy;

      spy = sinon.spy(function () { return document.createElement('row'); });

      module.createTable([0], 'Foo', ['Label'], spy);
      expect(spy.callCount).to.equal(1);
    });
  });
});
