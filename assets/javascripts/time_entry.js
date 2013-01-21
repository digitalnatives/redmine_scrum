var TE = {}

jQuery(function($) {

  // Modal form fields
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

    if(typeof serverObj.prev_remain_hours != 'undefined' && serverObj.last == true) TE.prevRemain = serverObj.prev_remain_hours;
    TE.updateSumCells(hours, remain, serverObj.issue_remain_hours.toString(), serverObj.last);

    $('#time-entry-dialog').dialog('close');
  }

  TE.updateCell = function(cell, value, only_span) {
    value = value.split('.');
    var hourInt = typeof(value[0]) == "undefined" ? 0 : value[0];
    var hourDec = typeof(value[1]) == "undefined" ? 0 : value[1];

    if(only_span) {
      cell.find('.hours-int').text(hourInt);
      cell.find('.hours-dec').text('.' + hourDec);
    } else {
      cell.html('');
      cell.append($('<span class="hours hours-int">').text(hourInt));
      cell.append($('<span class="hours hours-dec">').text('.' + hourDec));
    }
  }

  TE.updateSumCell = function(cell, prevValue, value) {
    cell.data().sum = (cell.data().sum - prevValue + parseFloat(value)).toFixed(2);
    TE.updateCell(cell, cell.data().sum.toString());
  }

  TE.updateTimeEntryCell = function(hours, remain) {
    TE.cell.data().teSumHours = (parseFloat(hours)).toFixed(2);
    TE.cell.data().teSumRemain = (parseFloat(remain)).toFixed(2);
    TE.updateCell(TE.cell, TE.cell.data().teSumHours.toString());
    TE.updateCell(TE.cell.next(), TE.cell.data().teSumRemain.toString());
  }

  TE.updateSumCells = function(hours, remain, taskRemain, last) {
    var taskSpentCell = TE.cell.siblings().last().prev();
    // Because of colspan
    TE.dailySpentCell = $(TE.cell.closest('table').find('tr:last').children()[TE.cell.index() - 3]);
    var totalSpentCell = TE.cell.closest('table').find('tr:last').find('td:last').prev();
    var idx = TE.cell.parent().index()
      for(var i = idx; i >= 0; i--){
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
    if(last) {
      var cell_idx = TE.idx;
      // Update daily totals for each day day after current
      $.each(TE.dailySpentCell.siblings().slice(TE.dailySpentCell.index()).filter('.period-end'), function(index, cell) {
        TE.updateSumCell($(cell), TE.sumRemain, remain)
        window.bd_chart.series[1].data[cell_idx][1] = $(cell).data().sum;
        cell_idx++;
      });
      // Update story totals for each day after current
      $.each(storySpentCell.siblings().slice(storySpentCell.index()).filter('.period-end'), function(index, cell) {
        TE.updateSumCell($(cell), TE.sumRemain, remain);
      });
      // Update remaining hours for each day after current
      $.each(TE.cell.siblings().slice(TE.cell.index()).filter('.period-end'), function(index, cell) {
        TE.updateCell($(cell), taskRemain, true);
        $(cell).prev().data().teSumRemain = taskRemain;
      });
      // Updating stroy total at last column
      TE.updateSumCell(storyTotalSpentCell.next(), TE.prevRemain, remain);
      // Updating task totat at last column
      TE.updateCell(taskSpentCell.next(), taskRemain);
      // Updating sum total last row in last column
      TE.updateSumCell(totalSpentCell.next(), TE.prevRemain, taskRemain);
    } else {
      TE.updateSumCell(TE.dailySpentCell.next(), TE.sumRemain, remain);
      TE.updateSumCell(storySpentCell.next(), TE.sumRemain, remain);
      window.bd_chart.series[1].data[TE.idx][1] = parseFloat(TE.dailySpentCell.next().data().sum) 
    }
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

  $('.issue_status').change(function(evt){
    $.post(
      '/scrum_report_time_entries/update_issue_status', 
      { issue_id: $(evt.target).attr('id').replace(/issue_status_/,''), 
        status_id: $(evt.target).val()}
    );
  });

//----------------------- KNOCKOUT --------------------------------
function Cell(data, day, issueId, prevCell) {
  var self = this;

  self.spent = ko.observable(data.spent);
  self.leftValue = ko.observable(data.left);
  self.hasTimeEntry = ko.observable(data.has_time_entry);
  self.day = day;
  self.issueId = issueId;
  self.storyId = data.story_id;
  self.prevCell = prevCell;

  self.spentFormatted = self.spent.toString().split('.')

  self.left = ko.computed({
    read: function() {
      if(self.hasTimeEntry()) return self.leftValue();
      if(prevCell) return self.prevCell.left(); 
      return self.leftValue();
    },
    write: function(value) {
      self.hasTimeEntry(true);
      self.leftValue(value);
    }
  })
}

function Row(data, days, issueId) {
  var self = this;

  self.isStory = false;
  self.issueId = issueId;
  self.prevCell;

  self.cells = ko.observableArray(
    ko.utils.arrayMap(days, function(day) {
      var cell = new Cell(data[day][issueId], day, issueId, self.prevCell);
      self.prevCell = cell;
      self.isStory = (typeof cell.storyId != "undefined") ? false : true;
      return cell;
    })
  )

  self.spent = ko.computed(function() {
    var sum = 0;
    ko.utils.arrayForEach(self.cells(), function(cell) {
      sum += Number(cell.spent());
    })
    return sum;
  })

  self.left = ko.computed(function() {
    return self.cells().last().left();
  })
}

function DailyTotalCell(data) {
  var self = this;

  self.day = data.day;
  self.index = data.index;

  self.spent = ko.computed(function() {
    var sum = 0;
    ko.utils.arrayForEach(data.entries, function(entry){
      sum += Number(entry.spent());
    })
    return sum;
  });

  self.left = ko.computed(function() {
    var sum = 0;
    ko.utils.arrayForEach(data.entries, function(entry){
      sum += Number(entry.left());
    })

    window.bdChart.series[1].data[self.index][1] = sum;
    window.bdChart.replot();
    return sum;
  });
}

function DailyTotalRow(rows, days) {
  var self = this;

  self.index = 0;

  self.cells = ko.observableArray(
    ko.utils.arrayMap(days, function(day) {
      var entries = [];
      ko.utils.arrayForEach(rows(), function(row) {
        var cell = $.grep(row.cells(), function(te) {
          return te.day == day && typeof te.storyId != "undefined";
        })[0];
        if(cell) entries.push(cell);
      })
      self.index++;
      return new DailyTotalCell({day: day, entries: entries, index: (self.index - 1)});
    })
  )

  self.spent = ko.computed(function() {
    var sum = 0;
    ko.utils.arrayForEach(rows(), function(row){
      if(row.isStory) return;
      sum += Number(row.spent());
    })
    return sum;
  })

  self.left = ko.computed(function() {
    var sum = 0;
    ko.utils.arrayForEach(rows(), function(row){
      if(row.isStory) return;
      sum += Number(row.left());
    })
    return sum;
  })

}

function ViewModel(data) {
  var self = this;

  // By clicking on cells this gets set
  self.selected = ko.observable();

  self.rows = ko.observableArray(
    ko.utils.arrayMap(data.issue_ids, function(issueId) {
      return new Row(data, data.days, issueId);
    })
  )
  //self.entries.valueHasMutated();

  self.addEntry = function() {
    self.entries.push(new TimeEntry)
  }

  self.days = data.days;
  self.dailyTotals = new DailyTotalRow(self.rows, data.days);

  self.previewJsonData = ko.computed(function() {
    return JSON.stringify(ko.toJS(self.entries), null, '\t');
  });
}

ko.bindingHandlers.modal = {
  init: function(element, valueAccessor) {
    $(element).dialog({ show: false }).bind("hidden", function() {
      var data = valueAccessor();
      data(null);
    });
    return ko.bindingHandlers.with.init.apply(this, arguments);
  },

  update: function(element, valueAccessor) {
    var value = ko.utils.unwrapObservable(valueAccessor());
    if(typeof value != "undefined" && typeof value.storyId == "undefined") return;

    $(element).dialog(value ? "open" : "close");
    return ko.bindingHandlers.with.update.apply(this, arguments);
  }
}

window.bdChart = jQuery.jqplot('burndown', [data.ideal_line, data.remain_line], {
  title:'Burndown Chart',
    axes:{
      xaxis:{
        label: "Days",
        renderer:$.jqplot.DateAxisRenderer,
        ticks: data.days,
        tickOptions:{
          formatString:'%b&nbsp;%#d'
        }
      },
      yaxis:{
        label: "Remaining",
        min: 0,
        max: data.sum_estimated_hours,
        tickOptions:{
         formatString:'%.2f'
        }
      }
    },
    highlighter: {
      show: true,
      sizeAdjust: 7.5
    },
    cursor: {
      show: false
    }
  });

window.viewModel = new ViewModel(data);

ko.applyBindings(viewModel);
})
