var TE = {}

jQuery(function($) {

  TE.spentOnDay = $('#spent-on-day');
  TE.issueIdField = $('#time_entry_issue_id');
  TE.hoursField = $('#time_entry_hours');
  TE.remainingHoursField = $('#time_entry_te_remaining_hours');
  TE.spentOnField = $('#time_entry_spent_on');
  TE.allFields = $([]).add(TE.hoursField).add(TE.remainingHoursField).add(TE.spentOnField).add(TE.issueIdField);
  TE.form = $('#set-time-entry-hours');
  TE.errorExplanation = TE.form.find("#errorExplanation ul");

  TE.form
  .bind("submit", function(evt) {
    $.post(evt.target.action, $(evt.target).serialize())
    .success(function(xhr, status, data) { 
      TE.handleSuccess(data);
    })
    .error(function(data, xhr, status) {
      TE.handleErrors($.parseJSON(data.responseText));
    });
    evt.preventDefault();
  })

  TE.handleErrors = function(data) {
    TE.errorExplanation.html('');
    for(var prop in data.errors) {
      if(data.errors.hasOwnProperty(prop)) {
        TE.errorExplanation.append(
          $('<li>').text(prop + ': ' + data.errors[prop][0])
          );
      }
    }
    TE.errorExplanation.parent().show();
  }

  TE.handleSuccess = function(data) {
    var hours = TE.hoursField.val();
    var remain = TE.remainingHoursField.val();
    var taskSpent = TE.cell.siblings().last().prev();
    // Because of colspan
    var dailySpent = $(TE.cell.closest('table').find('tr:last').children()[TE.cell.index() - 3]);
    var totalSpent = TE.cell.closest('table').find('tr:last').find('td:last').prev();
    if(TE.cell.data().teValues.length == 2) {
      TE.cell.data().teValues = [ hours, remain ];
    } else {
      TE.cell.data().teValues.push(hours, remain);
    } 
    TE.updateCell(TE.cell, hours);
    TE.updateCell(TE.cell.next(), remain);
    TE.updateSumCell(taskSpent, hours);
    TE.updateSumCell(dailySpent, hours);
    TE.updateSumCell(totalSpent, hours);
    $('#time-entry-dialog').dialog('close');
  }

  TE.updateCell = function(cell, value) {
    cell.html('');
    value = value.split('.');
    var hourInt = typeof(value[0]) == "undefined" ? 0 : value[0];
    var hourDec = typeof(value[1]) == "undefined" ? 0 : value[1];
    cell.append($('<span class="hours hours-int">').text(hourInt));
    cell.append($('<span class="hours hours-dec">').text('.' + hourDec));
  }

  TE.updateSumCell = function(cell, hours) {
    cell.data().sum = cell.data().sum - TE.prevHours + parseFloat(hours);
    TE.updateCell(cell, cell.data().sum.toString());
  }

  TE.formEdit = function(obj){
    this.id = obj.ids[0]
    this.prevHours = obj.values[0]
    this.prevReaminingHours = obj.values[1]
    this.form.attr('action', '/scrum_report_time_entries/' + this.id);
    this.form.prepend(
        $('<input>')
        .attr('type', 'hidden')
        .attr('name', '_method')
        .val('put')
        );

    this.hoursField.val(obj.values[0]);
    this.remainingHoursField.val(obj.values[1]);
  }

  TE.formNew = function(obj) {
    this.form.attr('action', '/scrum_report_time_entries');
    this.issueIdField.val(obj.issueId);
  }

  TE.load = function(el) {
    if (typeof ids !== "undefined" && ids !== null) return;
    TE.errorExplanation.parent().hide();

    this.taskSubject = $(el).siblings(':eq(1)').text();
    if($(el).data().teType == "hours") {
      this.cell = $(el);
    } else {
      this.cell = $(el).prev();
    }

    var timeEntry = {}
    timeEntry.ids = this.cell.data().teIds;
    timeEntry.values = this.cell.data().teValues;
    timeEntry.spentOn = this.cell.data().teSpentOn;
    timeEntry.issueId = this.cell.data().teTaskId;

    this.spentOnField.val(timeEntry.spentOn);
    this.spentOnDay.html(timeEntry.spentOn);

    this.form.find('input[name=_method]').remove();
    switch(timeEntry.ids.length){
    case 0:
      this.formNew(timeEntry);
      break;
    case 1:
      this.formEdit(timeEntry);
      break;
    default:
      console.log("multiple entries");
      console.log(el);
    }

    $('.ui-dialog-title').text(this.taskSubject);

  }


  $('#time-entry-dialog').dialog({
    autoOpen: false,
    modal: true,
    buttons: {
      "Save": function() {
        TE.form[0].submit();
      },
      "Cancel": function() {
        $(this).dialog("close");
      }
    },
    close: function() {
      TE.allFields.val('');
    }
  });

  $('.time-entry').click(function() {
    TE.load(this);
    $('#time-entry-dialog').dialog("open");
  });
})
