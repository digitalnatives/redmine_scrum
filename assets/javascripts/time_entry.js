var TE = {}

jQuery(function($) {

  TE.spentOnDaySpan = $('#spent-on-day');
  TE.assigneeSpan = $('#assignee');
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
    .success(function(data, returnStatus, xhr) { 
      TE.handleSuccess(xhr);
    })
    .error(function(xhr, returnStatus, error) {
      TE.handleErrors($.parseJSON(xhr.responseText));
    })
    .complete(function() {
      $('.rsindicator').removeClass('rssaving');
    });
    evt.preventDefault();
  })

  TE.handleErrors = function(data) {
    TE.errorExplanation.html('');
    for(var i = 0; i < data.errors.length; i++) {
      TE.errorExplanation.append($('<li>').text(data.errors[i][0] + ': ' + data.errors[i][1]));
    }
    TE.errorExplanation.parent().show();
  }

  TE.handleSuccess = function(data) {
    serverObj = $.parseJSON(data.responseText)
    var hours = TE.hoursField.val();
    var remain = TE.remainingHoursField.val();

    var taskSpent = TE.cell.siblings().last().prev();
    // Because of colspan
    var dailySpent = $(TE.cell.closest('table').find('tr:last').children()[TE.cell.index() - 3]);
    var totalSpent = TE.cell.closest('table').find('tr:last').find('td:last').prev();

    // data entry update
    TE.cell.data().teId = serverObj.id
    TE.cell.data().teHours = hours;
    TE.cell.data().teRemain = remain;
    // hours and remain cell update
    TE.updateTimeEntryCell(TE.cell, hours, remain);
    // sum hours cells update
    TE.updateSumCell(taskSpent, hours);
    TE.updateSumCell(dailySpent, hours);
    TE.updateSumCell(totalSpent, hours);

    $('#time-entry-dialog').dialog('close');
  }

  TE.updateCell = function(cell, value) {
    value = value.split('.');
    var hourInt = typeof(value[0]) == "undefined" ? 0 : value[0];
    var hourDec = typeof(value[1]) == "undefined" ? 0 : value[1];

    cell.html('');
    cell.append($('<span class="hours hours-int">').text(hourInt));
    cell.append($('<span class="hours hours-dec">').text('.' + hourDec));
  }

  TE.updateSumCell = function(cell, hours) {
    cell.data().sum = cell.data().sum - TE.prevHours + parseFloat(hours);
    TE.updateCell(cell, cell.data().sum.toString());
  }

  TE.updateTimeEntryCell = function(cell, hours, remain) {
    cell.data().teSumHours = TE.sumHours - TE.prevHours + parseFloat(hours)
    cell.data().teSumRemain = TE.sumRemain - TE.prevRemain + parseFloat(remain)
    TE.updateCell(cell, cell.data().teSumHours.toString());
    TE.updateCell(cell.next(), cell.data().teSumRemain.toString());
  }

  TE.formEdit = function(){
    this.form.attr('action', '/scrum_report_time_entries/' + this.id);
    this.form.prepend(
        $('<input>')
        .attr('type', 'hidden')
        .attr('name', '_method')
        .val('put')
        );

    this.hoursField.val(this.prevHours);
    this.remainingHoursField.val(this.prevRemain);
  }

  TE.formNew = function() {
    this.form.attr('action', '/scrum_report_time_entries');
    this.issueIdField.val(this.issueId);
  }

  TE.open = function(el) {
    if (typeof ids !== "undefined" && ids !== null) return;
    TE.errorExplanation.parent().hide();

    this.taskSubject = $(el).siblings(':eq(1)').text();
    if($(el).data().teType == "hours") {
      this.cell = $(el);
    } else {
      this.cell = $(el).prev();
    }

    this.id = this.cell.data().teId;
    this.prevHours = parseFloat(this.cell.data().teHours || 0);
    this.prevRemain = parseFloat(this.cell.data().teRemain || 0);
    this.sumHours = parseFloat(this.cell.data().teSumHours || 0);
    this.sumRemain = parseFloat(this.cell.data().teSumRemain || 0);
    this.issueId = this.cell.data().teTaskId;
    this.spentOnField.val(this.cell.data().teSpentOn);
    this.spentOnDaySpan.text(this.cell.data().teSpentOn);
    this.assigneeSpan.text($(el).siblings(':eq(2)').text());
    $('.ui-dialog-title').text(this.taskSubject);

    this.form.find('input[name=_method]').remove();
    if(this.id){
      this.formEdit();
    } else {
      this.formNew();
    }
  }

  $('#time-entry-dialog').dialog({
    autoOpen: false,
    modal: true,
    width: 320,
    buttons: {
      "Save": function() {
        $('.rsindicator').addClass('rssaving');
        TE.form.trigger('submit');
      },
      "Cancel": function() {
        $(this).dialog("close");
      }
    },
    close: function() {
      TE.allFields.val('');
    }
  });

  $('#time-report').delegate(".time-entry", "click", function() {
    TE.open(this);
    $('#time-entry-dialog').dialog("open");
  });
})
