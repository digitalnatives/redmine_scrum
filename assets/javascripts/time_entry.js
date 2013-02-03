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
    viewModel.selectedCell().left(data.cellLeft);
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
    });
  }

  self.cancel = function(element) {
    viewModel.selectedEntry("");
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

function Cell(data, day, issueId, prevCell) {
  var self = this;

  self.spent = ko.observable(data.spent);
  self.leftValue = ko.observable(data.left);
  self.hasTimeEntry = ko.observable(data.has_time_entry);
  self.day = day;
  self.issueId = issueId;
  self.storyId = data.story_id;
  self.prevCell = prevCell;
  self.subject = data.subject;
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
  });
}

function StoryCell(data, day, issueId) {
  var self = this;

  self.day = day;
  self.isStory = true
  self.issueId = issueId;
  self.hasTimeEntry = false;
  self.cells = ko.observableArray();

  self.spent = ko.computed(function() {
    var sum = 0;
    ko.utils.arrayForEach(self.cells(), function(cell) {
      sum += Number(cell.spent());
    })
    return sum;
  });

  self.left = ko.computed(function() {
    var sum = 0;
    ko.utils.arrayForEach(self.cells(), function(cell) {
      sum += Number(cell.left());
    })
    return sum;
  });
}

function Row(data, issueId, assignee) {
  var self = this;

  self.isStory = (typeof data[data.days[0]][issueId].story_id != "undefined") ? false : true
  self.storyId = data[data.days[0]][issueId].story_id;
  self.issueId = issueId;
  self.prevCell;
  self.storySubject = data[data.days[0]][issueId].story_subject;
  self.subject = data[data.days[0]][issueId].subject;
  self.assigneeId = ko.observable(data[data.days[0]][issueId].assignee_id);
  self.statusId = ko.observable(data[data.days[0]][issueId].status_id);
  self.assignee = ko.observable(assignee);
  self.currentStatus = data[data.days[0]][issueId].status;
  self.estimated = data[data.days[0]][issueId].estimated;
  self.formattedSubject = function () {
    if(self.isStory) {
      return '#' + self.issueId + ': ' + self.storySubject;
    } else {
      return '#' + self.issueId + ': ' + self.subject;
    }
  }

  self.cells = ko.observableArray(
    ko.utils.arrayMap(data.days, function(day) {
      if(self.isStory) {
        return new StoryCell(data[day][issueId], day, issueId);
      } else {
        var cell = new Cell(data[day][issueId], day, issueId, self.prevCell);
        self.prevCell = cell;
        return cell;
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
    return Math.round(sum * 100) / 100;
  });


  self.left = ko.computed(function() {
    var sum = 0;
    ko.utils.arrayForEach(data.entries, function(entry){
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

  self.days = data.days;
  // Set by cellDetails
  self.selectedEntry = ko.observable();
  // Set by cellDetails
  self.selectedCell = ko.observable();
  self.entries = ko.observableArray();
  self.assignees = ko.utils.arrayMap(data.assignees, function(assignee) {
      return new Assignee(assignee);
  });

  self.rows = ko.observableArray(
    ko.utils.arrayMap(data.issue_ids, function(issueId) {
      var assignee = $.grep(self.assignees, function(a) {
        return a.id == data[data.days[0]][issueId].assignee_id;
      })[0]
      return new Row(data, issueId, assignee);
    })
  );

  self.dailyTotals = new DailyTotalRow(self.rows, data.days);

  // By clicking on cells this gets set
  self.cellDetails = function(cell) {
    $.getJSON('/scrum_report_time_entries/' + cell.issueId + '?day=' + cell.day, function(serverData){
      var data = $.parseJSON(serverData.entries);
      var mappedEntries = $.map(data, function(entry) { 
        entry.subject = cell.subject;
        return new TimeEntry(entry);
      });
      self.selectedCell(cell);
      if(mappedEntries.length == 0){
        var timeEntry = new TimeEntry({issueId: cell.issueId, day: cell.day, subject: cell.subject});
        self.selectedEntry(timeEntry);
        self.entries([ timeEntry ]);
      } else {
        self.selectedEntry(mappedEntries[0]);
        self.entries(mappedEntries);
      }
    })
  }

  self.editEntry = function(entry) {
    self.selectedEntry(entry);
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

$.each(viewModel.rows(), function(index, row) {
  if(!row.isStory) return;

  var storyRow = row;
  $.each(viewModel.rows(), function(index, row) {
    if(row.storyId == storyRow.issueId) {
      for(var i = 0; i < row.cells().length; i++) {
        storyRow.cells()[i].cells.push(row.cells()[i]);
      }
    }
  });
});

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

// cleanup
window.data = null;
})
