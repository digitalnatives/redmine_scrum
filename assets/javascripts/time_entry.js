jQuery(function($) {

//----------------------- KNOCKOUT --------------------------------
function Assignee(data) {
  var self = this;

  self.id = data.id
  self.name = data.name
}

function IssueStatus(data) {
  var self = this;

  self.id = data.id;
  self.name = data.name;
}

function TimeEntry(data) {
  var self = this;

  self.id = ko.observable(data.id);
  self.issueId = data.issueId;
  self.day = data.day;
  self.spent = ko.observable(data.spent);
  self.left = ko.observable(data.left);
  self.activityId = ko.observable(data.activityId);
  self.activity = ko.observable(data.activity);
  self.userId = ko.observable(data.userId);
  self.userName = ko.observable(data.userName);
  self.assigneeId = data.assigneeId;
  self.saved = false;
  self.subject = data.subject;
  self.errors = ko.observableArray();

  self.info = self.userName + ' (' + self.activity + ') ' + self.spent() + ' : ' + self.left();

  self.title = ko.computed(function(){
    if(self.id()) {
      return "Edit time entry"
    } else {
      return "New time entry"
    }
  });

  self.saveOk = function(data) {
    // handling null
    viewModel.selectedCell().left(data.cellLeft || viewModel.selectedCell().left());
    viewModel.selectedCell().spent(data.cellSpent);
    self.activityId(data.activityId);
    self.activity(data.activity);
    self.userId(data.userId);
    self.userName(data.userName);
    self.id(data.id);
    viewModel.selectedEntry(self);
    ko.utils.arrayForEach(viewModel.dailyTotals.cells(), function(cell) {
      window.bdChart.series[1].data[cell.index][1] = cell.left();
    })
    window.bdChart.replot();
    self.saved = true;
  }

  self.save = function(data) {
    var url;
    var type;

    self.errors([]);
    jsonData = {
      time_entry: ko.toJS({
        id: self.id,
        issue_id: self.issueId,
        spent_on: self.day,
        hours: self.spent,
        te_remaining_hours: self.left,
        activity_id: self.activityId,
        user_id: self.userId
      })
    }
    if(self.id() > 0) { 
      type = "put";
      url = "/scrum_report_time_entries/" + self.id();
    } else {
      type = "post";
      url = "/scrum_report_time_entries";
    }
    $('.rsindicator').addClass('rssaving');
    $.ajax({ 
      type: type, 
      url: url, 
      data: jsonData,
      success: function(data) {
        self.saveOk(data);
      },
      error: function(data, textStatus, error) {
        $.parseJSON(data.responseText).errors.each(function(element) {
          self.errors.push({ id: element[0], name: element[1] })
        });
        console.log(data);
      }
    })
    .always(function() {
      $('.rsindicator').removeClass('rssaving');
    });
  }

  self.close = function(element) {
    viewModel.selectedEntry("");
    viewModel.selectedCell("");
  }

  self.newEntry = function() {
    newEntry = new TimeEntry({
      issueId: self.issueId,
      day: self.day,
      subject: self.subject
    })
    viewModel.entries.push(newEntry);
    viewModel.selectedEntry(newEntry);
  }
}

function Cell(data, prevCell) {
  var self = this;

  self.spent = ko.observable(data.spent);
  self.leftValue = ko.observable(data.left);
  self.timeEntryCount = ko.observable(data.time_entry_count);
  self.day = data.day;
  self.issueId = data.issue_id;
  self.storyId = data.story_id;
  self.prevCell = prevCell;
  self.subject = data.subject;
  self.assigneeId = data.assignee_id;
  self.formattedSubject = '#' + self.issueId + ': ' + self.subject;

  self.left = ko.computed({
    read: function() {
      if(!!self.timeEntryCount()) return self.leftValue();
      if(prevCell) return self.prevCell.left(); 
      return self.leftValue();
    },
    write: function(value) {
      self.timeEntryCount(self.timeEntryCount() + 1);
      self.leftValue(value);
    }
  });

}

function StoryCell(data) {
  var self = this;

  self.day = data.day;
  self.isStory = true
  self.issueId = data.issue_id;
  self.timeEntryCount = 0;
  self.observedCells = ko.observableArray();

  self.spent = ko.computed(function() {
    var sum = 0;
    ko.utils.arrayForEach(self.observedCells(), function(cell) {
      sum += Number(cell.spent());
    })
    return sum;
  });

  self.left = ko.computed(function() {
    var sum = 0;
    ko.utils.arrayForEach(self.observedCells(), function(cell) {
      sum += Number(cell.left());
    })
    return sum;
  });

}

function Row(data, assignee) {
  var self = this;

  self.isStory = data.is_story;
  self.storyId = data.story_id;
  self.issueId = data.issue_id;
  self.prevCell;
  self.storySubject = data.story_subject;
  self.subject = data.subject;
  self.assigneeId = ko.observable(data.assignee_id);
  self.statusId = ko.observable(data.status_id);
  self.assignee = assignee;
  self.currentStatus = data.status;
  self.estimated = Number(data.estimated);
  self.assigneeName = data.assignee_name;

  self.formattedSubject = function () {
    if(self.isStory) {
      return '#' + self.storyId + ': ' + self.storySubject;
    } else {
      return '#' + self.issueId + ': ' + self.subject;
    }
  }

  self.cells = ko.observableArray(
    ko.utils.arrayMap(data.cells, function(cell) {
      if(self.isStory) {
        return new StoryCell(cell);
      } else {
        var currentCell = new Cell(cell, self.prevCell);
        self.prevCell = currentCell;
        return currentCell;
      }
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

  self.isVisible = function(filter) {
    if(self.isStory) return true;
    if(!filter.byStatus && !filter.byAssignee) return true; 
    if(!!filter.byStatus && !!filter.byAssignee) {
      return (self.statusId() == filter.byStatus.id && self.assigneeId() == filter.byAssignee.id) ? true : false;
    }
    if(!!filter.byStatus) {
      return (self.statusId() == filter.byStatus.id) ? true : false;
    }
    if(!!filter.byAssignee) {
      return (self.assigneeId() == filter.byAssignee.id) ? true : false;
    }
  }
}

function DailyTotalCell(data) {
  var self = this;

  self.day = data.day;
  self.index = data.index;
  self.observedCells = ko.observableArray();

  self.spent = ko.computed(function() {
    var sum = 0;
    ko.utils.arrayForEach(self.observedCells(), function(entry){
      sum += Number(entry.spent());
    })
    return Math.round(sum * 100) / 100;
  });


  self.left = ko.computed(function() {
    var sum = 0;
    ko.utils.arrayForEach(self.observedCells(), function(entry){
      sum += Number(entry.left());
    })

    return Math.round(sum * 100) / 100;
  });
}

function DailyTotalRow(rows, days) {
  var self = this;

  self.index = 0;

  self.cells = ko.observableArray(
    ko.utils.arrayMap(days, function(day) {
      self.index++;
      return new DailyTotalCell({day: day, index: (self.index - 1)});
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

  self.days = data.days;
  // Set by cellDetails
  self.selectedEntry = ko.observable();
  // Set by cellDetails
  self.selectedCell = ko.observable();
  self.entries = ko.observableArray();
  self.assignees = ko.utils.arrayMap(data.assignees, function(assignee) {
      return new Assignee(assignee);
  });
  self.issueStatuses = ko.utils.arrayMap(data.issue_statuses, function(issueStatus) {
      return new IssueStatus(issueStatus);
  });
  self.filterAssignee = ko.observable();
  self.filterStatus = ko.observable();

  self.rows = ko.observableArray(
    ko.utils.arrayMap(data.rows, function(row) {
      var assignee = $.grep(self.assignees, function(a) {
        return a.id == row.assignee_id;
      })[0]
      return new Row(row, assignee);
    })
  );

  self.dailyTotals = new DailyTotalRow(self.rows, data.days);

  // By clicking on cells this gets set
  self.cellDetails = function(cell) {
    if(cell.timeEntryCount() == 0) {
      self.selectedCell(cell);
      var timeEntry = new TimeEntry({issueId: cell.issueId, 
        day: cell.day,
          subject: cell.formattedSubject,
          userId: cell.assigneeId,
          assigneeId: cell.assigneeId});
      self.selectedEntry(timeEntry);
      self.entries([ timeEntry ]);
    } else {
      $.getJSON('/scrum_report_time_entries/' + cell.issueId + '?day=' + cell.day, function(serverData){
        var data = $.parseJSON(serverData.entries);
        var mappedEntries = $.map(data, function(entry) { 
          entry.subject = cell.formattedSubject;
          return new TimeEntry(entry);
        });
        self.selectedCell(cell);
        self.selectedEntry(mappedEntries[0]);
        self.entries(mappedEntries);
      })
    }
  }

  self.editEntry = function(entry) {
    self.selectedEntry(entry);
  }

  // highlight today row in table
  self.isToday = function(day) {
    cellDay = new Date(Date.parse(day))
    today = new Date()
    if(cellDay.getDate() == today.getDate() &&
       cellDay.getMonth() ==  today.getMonth() &&
       cellDay.getFullYear() == today.getFullYear()) { 
      return true;
    } else { 
      return false; 
    }
  }

  self.previewJsonData = ko.computed(function() {
    //return JSON.stringify(ko.toJS(self.entries), null, '\t');
  });
}

//custom binding to initialize a jQuery UI dialog
ko.bindingHandlers.jqDialog = {
  init: function(element, valueAccessor) {
    var options = ko.utils.unwrapObservable(valueAccessor()) || {};

    //handle disposal
    ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
      $(element).dialog("destroy");
    });

    $(element).dialog(options);
  }
};

//custom binding handler that opens/closes the dialog
ko.bindingHandlers.openDialog = {
  update: function(element, valueAccessor) {
    var value = ko.utils.unwrapObservable(valueAccessor());
    if (value) {
      if(!value.id()) { $(element).find('#time_entry_user_id').val(value.assigneeId); }
      $(element).dialog("open");
      $(element).dialog({
        title: value.subject 
      });
    } else {
      $(element).dialog("close");
    }
  }
}

//custom binding to initialize a jQuery UI button
ko.bindingHandlers.jqButton = {
  init: function(element, valueAccessor) {
    var options = ko.utils.unwrapObservable(valueAccessor()) || {};

    //handle disposal
    ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
      $(element).button("destroy");
    });

    $(element).button(options);
  }
};

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

var storyRow;
$.each(viewModel.rows(), function(index, row) {
  if(row.isStory){
    for(var i = 0; i < viewModel.dailyTotals.cells().length; i++) {
      viewModel.dailyTotals.cells()[i].observedCells.push(row.cells()[i]);
    }
    storyRow = row;
  } 
  else {
    if(row.storyId == storyRow.issueId) {
      for(var i = 0; i < row.cells().length; i++) {
        storyRow.cells()[i].observedCells.push(row.cells()[i]);
      }
    }
  }
});
ko.utils.arrayForEach(viewModel.dailyTotals.cells(), function(cell) {
  window.bdChart.series[1].data[cell.index][1] = cell.left();
})
window.bdChart.replot();

ko.applyBindings(viewModel);

// Set row height to same
var otherTrs = jQuery('#ko-table-body-right').last().find("tr");
jQuery('#ko-table-body-left').last().find("tr").each(function(index,row) {
  jQuery(otherTrs[index]).height(jQuery(row).height());
})

// Set table width same
$('#ko-table-body-right').width($('#ko-table-header-right').width())

// Follow scroll
$('#ko-body-right').scroll(function() {
  $('#ko-header-right').scrollLeft($(this).scrollLeft());
  $('#ko-body-left').scrollTop($(this).scrollTop());
});

// scroll to today on page load
jQuery('#ko-body-right').animate({scrollLeft: jQuery('.today').first().position().left - (jQuery('#ko-body-right').position().left * 1.7)}, 'fast')

$("#ko-table-body-right").delegate("td.clickable", "click", function() {
  var context = ko.contextFor(this);
  if(context) {
    context.$root.cellDetails(context.$data);
  }
});

// cleanup
window.data = null;
})
