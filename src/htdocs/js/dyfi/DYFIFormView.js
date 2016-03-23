'use strict';

var Events = require('util/Events'),
    Formatter = require('core/Formatter'),
    LocationView = require('locationview/LocationView'),
    Model = require('mvc/Model'),
    ModalView = require('mvc/ModalView'),
    QuestionView = require('questionview/QuestionView'),
    TextQuestionView = require('dyfi/TextQuestionView'),
    Util = require('util/Util'),
    View = require('mvc/View'),
    Xhr = require('util/Xhr');


var DEFAULTS = {
  eventTime: null,
  language: 'en',
  url: 'js/languages/'
};

var DYFI_DISCLAIMER = '<p>' +
    '<strong>Privacy Act Statement</strong>' +
    ' You are not required to provide your personal contact information in' +
    ' order to submit your survey. However, if you do not provide contact' +
    ' information, we may be unable to contact you for additional information' +
    ' to verify your responses. If you do provide contact information, this' +
    ' information will only be used to initiate follow-up communications with' +
    ' you. The records for this collection will be maintained in the' +
    ' appropriate Privacy Act System of Records identified as Earthquake' +
    ' Hazards Program Earthquake Information. (INTERIOR/USGS-2) published' +
    ' at 74 FR 34033 (July 14,2009).' +
    '</p>' +
    '<p>' +
    '<strong>Paperwork Reduction Act Statement</strong>' +
    ' The Paperwork Reduction Act of 1995 (44 U.S.C. 3501 et. seq.) requires' +
    ' us to inform you that this information is being collected to supplement' +
    ' instrumental data and to promote public safety through better' +
    ' understanding of earthquakes. Response to this request is voluntary.' +
    ' Public reporting for this form is estimated to average 6 minutes per' +
    ' response, including the time for reviewing instructions and completing' +
    ' the form. A Federal agency may not conduct or sponsor, and a person is' +
    ' not required to respond to, a collection of information unless it' +
    ' displays a currently valid OMB Control Number. Comments regarding this' +
    ' collection of information should be directed to: Bureau Clearance' +
    ' officer, U.S. Geological Survey, 807 National Center, Reston, VA 20192.' +
    '</p>';

/**
 * View for the DYFI Form. This view retrieves the questions/answers from the
 * appropriate language object, builds the form, and binds the questions to
 * the model using the updateModel method.
* @param options {Object}
 *     Configuration options for this module. See _initialize method
 *     documentation for details.
 *
 * Class variables.
 *  _data: {object} Contains the questions/answers from the language object.
 *  _questions: {ojbect} An object containing the question views.
 */
var DYFIFormView = function (options) {
  var _this,
      _initialize,

      _data,
      _formatter,
      _options,
      _questions = {};


  _this = View(options);

  /**
   * Constructor. Initializes a new DYFIView.
   *
   * @params language {string}
   *    The language to fetch the questions for.
   * @params eventTime {string}
   *    The time of the event.
   * @params url {string}
   *    The url location for the language/questions object.
   */
  _initialize = function (options) {
    _options = Util.extend({}, DEFAULTS, options || {});

    _data = null;
    _formatter = _options.formatter || Formatter();
    if (!_this.model.get('language')) {
      _this.model.set({language: _options.language}, {silent: true});
    }
    if (!_this.model.get('eventTime')) {
      _this.model.set({eventTime: _options.eventTime}, {silent: true});
    }
  };

  /**
   * Adds Listeners to all questions in the questions object.
   */
  _this.addQuestionListeners = function () {
    for (var field in _questions) {
      _questions[field].on('change', _this.updateModel);
    }
  };

  /**
   * Create DFYI Form
   *  Spins through the questions object, and builds the appropriate sections.
   */
  _this.createForm = function () {
    var el = _this.el,
        // Form Elements
        baseQuestionsEl,
        contactContainer,
        disclaimerEl,
        header,
        moreQuestionsEl,
        toggleContainer,
        // data information
        baseQuestions,
        contactInfo,
        eventTime,
        moreQuestions,
        locationInfo,
        toggleInfo;

    baseQuestions = _data.baseQuestions;
    contactInfo = _data.contactInfo;
    eventTime = _data.eventTime;
    moreQuestions = _data.moreQuestions;
    locationInfo = _data.locationInfo;
    toggleInfo = _data.toggleInfo;

    header = el.appendChild(document.createElement('header'));
    baseQuestionsEl = el.appendChild(document.createElement('div'));
    baseQuestionsEl.classList.add('dyfi-required-questions');
    toggleContainer = el.appendChild(document.createElement('div'));
    toggleContainer.classList.add('dyfi-optional-callout', 'alert', 'info');
    moreQuestionsEl = el.appendChild(document.createElement('div'));
    moreQuestionsEl.classList.add('dyfi-optional-questions');
    contactContainer = document.createElement('div');
    contactContainer.classList.add('dyfi-contact-questions', 'alert');
    disclaimerEl = document.createElement('a');

    header.innerHTML = '<h3 class="felt-header">Felt Report</h3>' +
        '<div class="omb-number">OMB No. 1028-0048' +
        '<br/>Expires 05/31/2018' +
        '</div>';

    // Handle location question
    _this.createLocationQuestions(locationInfo, baseQuestionsEl);

    if (_this.model.get('eventTime') === null) {
        _this.createTextQuestion(eventTime, baseQuestionsEl);
    }

    // Loop over each base question and create a QuestionView
    _this.createQuestions(baseQuestions, baseQuestionsEl);

      // Visual control to show/hide moreQuestionsEl
    _this.createToggleControl(toggleInfo, toggleContainer);

    // Loop over each additional question and create a QuestionView
    _this.createQuestions(moreQuestions, moreQuestionsEl);

    // Handle additional comments
    _this.createTextQuestion(_data.comments, moreQuestionsEl);

    // Handle contact information
    contactContainer.innerHTML = '<legend>Contact Information' +
        ' <small>(optional)</small></legend>';
    _this.createTextQuestion(contactInfo, contactContainer);
    moreQuestionsEl.appendChild(contactContainer);

    // Add disclaimer link
    disclaimerEl.className = 'dyfi-disclaimer';
    disclaimerEl.href = '/research/dyfi/disclaimer.php#DYFIFormDisclaimer';
    disclaimerEl.innerHTML = 'PRA - Privacy Statement';
    disclaimerEl.addEventListener('click', function (e) {
      var dialog = ModalView(DYFI_DISCLAIMER, {
        title: 'PRA - Privacy Statement',
        closable: false,
        buttons: [
          {
            text: 'OK',
            classes: ['green'],
            callback: function () {
              dialog.hide();
              dialog.destroy();
              dialog = null;
            }
          }
        ]
      }).show();
      e.preventDefault();
    });

    contactContainer.appendChild(disclaimerEl);

    _this.synchQuestionAnswers();
    _this.addQuestionListeners();
    // TODO :: More interaction like progress meter.

  };

  /**
   * Creates Location Questions.
   *    Location questions are not visible to users, instead a button is
   *    visible that calls a LocationView. Which then fills in the
   *    location questions. The location questions are a minimum subset of
   *    the QuestionView API.
   *
   * @params questionInfo {object}
   *    locationInfo: {object}
   *      label: {string}
   *      button: {string}
   *      buttonUpdate: {string}
   * @params container {dom element}
   */
  _this.createLocationQuestions = function (questionInfo, container) {
    var section = document.createElement('section'),
        fieldset = section.appendChild(document.createElement('fieldset')),
        legend = fieldset.appendChild(document.createElement('legend')),
        display = fieldset.appendChild(document.createElement('div')),
        button = fieldset.appendChild(document.createElement('button')),
        curLoc = {},
        locationView = null;

    section.classList.add('question');
    legend.innerHTML = questionInfo.label;
    button.innerHTML = questionInfo.button;
    button.classList.add('location-button');

    // Add QuestionView-like objects to the list of questions
    _questions.ciim_mapLat = Events();
    _questions.ciim_mapLat.model = Model({field:'ciim_mapLat'});
    _questions.ciim_mapLat.getAnswers = function () {
      return {value: curLoc.latitude};
    };
    _questions.ciim_mapLat.setAnswers = function (latitude) {
      curLoc.latitude = latitude;
    };

    _questions.ciim_mapLon = Events();
    _questions.ciim_mapLon.model = Model({field:'ciim_mapLon'});
    _questions.ciim_mapLon.getAnswers = function () {
      return {value: curLoc.longitude};
    };
    _questions.ciim_mapLon.setAnswers = function (longitude) {
      curLoc.longitude = longitude;
    };

    _questions.ciim_mapConfidence = Events();
    _questions.ciim_mapConfidence.model = Model({field:'ciim_mapConfidence'});
    _questions.ciim_mapConfidence.getAnswers = function () {
        return {value: curLoc.confidence};
    };
    _questions.ciim_mapConfidence.setAnswers = function () {};

    _questions.ciim_mapAddress = Events();
    _questions.ciim_mapAddress.model = Model({field:'ciim_mapAddress'});
    _questions.ciim_mapAddress.getAnswers = function () {
        return {value: curLoc.place};
    };
    _questions.ciim_mapConfidence.setAnswers = function () {};

    locationView = LocationView({
      callback: function (locationObject) {
        var markup = [],
            prettyLat = null,
            prettyLng = null;

        curLoc = locationObject;

        prettyLat = curLoc.latitude;
        if (prettyLat < 0.0) {
          prettyLat = (-1.0*prettyLat).toFixed(curLoc.confidence) + '&deg;S';
        } else {
          prettyLat = prettyLat.toFixed(curLoc.confidence) + '&deg;N';
        }

        prettyLng = curLoc.longitude;
        if (prettyLng < 0.0) {
          prettyLng = (-1.0*prettyLng).toFixed(curLoc.confidence) + '&deg;W';
        } else {
          prettyLng = prettyLng.toFixed(curLoc.confidence) + '&deg;E';
        }

        if (curLoc.place !== null) {
          markup.push(curLoc.place + '<br/>');
        }

        display.classList.add('location-result', 'alert', 'success');

        display.innerHTML = '<span class="address">' +
            ((curLoc.place) ? (curLoc.place + '</span>') : '') +
            '<span class="coordinates">' +
            prettyLat + ', ' + prettyLng +
            ((curLoc.place) ? '' : '</span>');


        button.innerHTML = questionInfo.buttonUpdate;

        _questions.ciim_mapLat.trigger('change', _questions.ciim_mapLat);
        _questions.ciim_mapLon.trigger('change', _questions.ciim_mapLon);
      }
    });

    button.addEventListener('click', function () {
      locationView.show({initialLocation: curLoc});
    });

    // Append content to container
    container.appendChild(section);
  };

  /**
   * Helper method to iterate over a hash of questionInfo creating a view
   * for each question, appending the views content to the container, and
   * holding on to a reference to that view on the question hash (keyed by the
   * same field as in the questionInfo hash).
   *
   * @param questionInfo {Object}
   *      An object of question information keyed by the field name
   *      corresponding to that information as expected by the DYFI form
   *      processing code.
   * @param container {DOMElement} pass-by-reference
   *      The container into which the view.el should be appended.
   */
  _this.createQuestions = function (questionInfo, container) {
    var field = null,
        view = null;

    for (field in questionInfo) {
      view = QuestionView(Util.extend(
          {el: document.createDocumentFragment()},
          questionInfo[field],
          {model: Model({field: field})})
      );

      _questions[field] = view;
      container.appendChild(view.el);
    }
  };

  /**
   * Creates a set of text questions.
   *    see createQuestions for general overview.
   *    The main difference is that this calls TextQuestionView
   *    to handle questions that use input/Text-Area as it's type.
   */
  _this.createTextQuestion = function (questionInfo, container) {
    var field = null,
        view = null;

    for (field in questionInfo) {
      view = TextQuestionView(Util.extend(
          {el: document.createDocumentFragment()},
          questionInfo[field],
          {model: Model({field: field})}));

      _questions[field] = view;
      container.appendChild(view.el);
    }
  };


  /**
   * sets the text of the toggle control, which informs the user whether
   * they need to continue filling the form or not.
   */
  _this.createToggleControl = function (info, control) {
    control.innerHTML = info.description;
  };

  /**
   * Free references.
   */
  _this.destroy = Util.compose(function () {
    if (_questions !== null) {
      if (_questions.ciim_time) {
        _questions.ciim_time.el.removeEventListener('change',
            _this.updateSubmitEnabled);
      }
      _this.destroyForm();
      _questions = null;
    }

    _this = null;
  }, _this.destroy);

  /**
   * Destroys the questions in the Form.
   */
  _this.destroyForm = function () {
    for (var field in _questions) {
      _questions[field].off('change');
      _questions[field].destroy();
    }
  };

  /**
   * Render the form.
   *
   * @param changed {object}
   *    Contains a key:value pair of any question that has changed.
   *    If the object is null, or if the key is language, then the
   *    entire form is rendered, after fetching the language object.
   *    If it contains any other key, it updates the specific answer.
   */
  _this.render = function (changed) {
    if (!changed || changed.hasOwnProperty('language')) {
      _this.renderQuestions();
    } else {
        _this.updateAnswer(changed);
    }
  };

  /**
   * Renders the Question form after fetching the language object.
   */
  _this.renderQuestions = function () {
    var language;

    language = _this.model.get('language');

    Xhr.ajax({
      url: _options.url + language + '.json',
      success: function (data) {
        if (_data !== null) {
          _this.destroyForm();
        }

        _data = data;
        _this.createForm();
      },
      error: function (e) {
        console.log(e);
      }
    });
  };

  /**
   * Updates the Model when a question is changed.
   *
   * @params question {QuestionView}
   *    The question that has changed.
   */
  _this.updateModel = function (question) {
    var answer,
        field;

    field = question.model.get('field');
    answer = question.getAnswers();

    _this.model.set(_this.stripAnswer(field, answer));
  };

  /**
   * Update Answer for a question.
   *
   * @params changed {object}
   *     holds a key/value pair of the questionid/answer that has changed.
   */
  _this.updateAnswer = function (changed) {
    var field;

    for (field in changed) {
      _questions[field].setAnswers(changed[field]);
    }
  };

  /**
   * Synch's questions with the model answers.
   */
  _this.synchQuestionAnswers = function () {
    var field;

    for (field in _questions) {
      if (_this.model.hasOwnProperty(field)) {
        _questions[field].set(_this.model.get(field));
      }
    }
  };

  /**
   * Strips an Answer from the object a question passes back. And packages it
   *   in an object for the model.
   *
   * @params field {string}
   *    The name of a question.
   * @param answer {string}
   *    An answer from a questionView
   */
  _this.stripAnswer = function (field, answers) {
    var answerObject,
        cnt,
        fieldOther;

    answerObject = {};
    if (answers instanceof Array) {
      answerObject[field] = [];
      for (cnt = 0; cnt < answers.length; cnt++) {
        answerObject[field].push(answers[cnt].value);
      }
    } else if (answers instanceof Object && answers.value !== undefined) {
      answerObject[field] = answers.value;
      if(answers.value === '_Other') {
        fieldOther = field + '_Other';
        answerObject[fieldOther] = answers.otherValue;
      }
    } else {
      answerObject[field] = '';
    }

    return answerObject;
  };

  _initialize(options);
  options = null;
  return _this;
};

module.exports = DYFIFormView;
