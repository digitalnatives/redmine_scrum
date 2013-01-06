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
    var serverObj = $.parseJSON(data.responseText);
    var hours = TE.hoursField.val();
    var remain = TE.remainingHoursField.val();

    // data entry update
    TE.cell.data().teId = serverObj.te_id
    TE.cell.data().teHours = hours;
    TE.cell.data().teRemain = remain;

    TE.updateTimeEntryCell(hours, remain);

    if(typeof serverObj.prev_remain_hours != 'undefined') TE.prevRemain = serverObj.prev_remain_hours;
    TE.updateSumCells(hours, remain, serverObj.issue_remain_hours.toString(), serverObj.last);
    TE.updateBurndownChart();

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

  TE.updateSumCell = function(cell, prevValue, value) {
    cell.data().sum = (cell.data().sum - prevValue + parseFloat(value)).toFixed(2);
    TE.updateCell(cell, cell.data().sum.toString());
  }

  TE.updateTimeEntryCell = function(hours, remain) {
    TE.cell.data().teSumHours = (TE.sumHours - TE.prevHours + parseFloat(hours)).toFixed(2);
    TE.cell.data().teSumRemain = (TE.sumRemain - TE.prevRemain + parseFloat(remain)).toFixed(2);
    TE.updateCell(TE.cell, TE.cell.data().teSumHours.toString());
    TE.updateCell(TE.cell.next(), TE.cell.data().teSumRemain.toString());
  }

  TE.updateSumCells = function(hours, remain, taskRemain, last) {
    var taskSpentCell = TE.cell.siblings().last().prev();
    // Because of colspan
    TE.dailySpentCell = $(TE.cell.closest('table').find('tr:last').children()[TE.cell.index() - 3]);
    var totalSpentCell = TE.cell.closest('table').find('tr:last').find('td:last').prev();
    var idx = TE.cell.parent().index()
      for(i = idx; i >= 0; i--){
        if($(TE.cell.parent().parent().children()[i]).attr('class').search("subtotal") == 0) {
          var storySpentCell = TE.cell.parent().parent().find('tr:nth-child(' + (i + 1) + ') td:nth-child(' + (TE.cell.index() - 2) + ')')
          break;
        }
      } 
    var storyTotalSpentCell = storySpentCell.siblings().last().prev();

    //sum hours
    TE.updateSumCell(TE.dailySpentCell, TE.prevHours, hours);
    TE.updateSumCell(storySpentCell, TE.prevHours, hours);
    TE.updateSumCell(storyTotalSpentCell, TE.prevHours, hours);
    TE.updateSumCell(taskSpentCell, TE.prevHours, hours);
    TE.updateSumCell(totalSpentCell, TE.prevHours, hours);

    //sum remaining
    TE.updateSumCell(TE.dailySpentCell.next(), TE.prevRemain, remain);
    TE.updateSumCell(storySpentCell.next(), TE.prevRemain, remain);
    if(last) TE.updateSumCell(storyTotalSpentCell.next(), TE.prevRemain, remain);
    if(last) TE.updateCell(taskSpentCell.next(), taskRemain);
    if(last) TE.updateSumCell(totalSpentCell.next(), TE.prevRemain, taskRemain);
  }

  TE.updateBurndownChart = function() {
    window.bd_chart.series[1].data[TE.idx][1] = parseFloat(TE.dailySpentCell.next().data().sum) 
    window.bd_chart.replot();
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

    this.idx = this.cell.data().teIdx;
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
