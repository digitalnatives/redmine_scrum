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

  self.id = data.id;
  self.issueId = data.issueId;
  self.day = data.day;
  self.spent = ko.observable(data.spent);
  self.left = ko.observable(data.left);
  self.activityId = ko.observable(data.activityId);
  self.activity = ko.observable(data.activity);
  self.userId = ko.observable(data.userId);
  self.userName = ko.observable(data.userName);
  self.saved = false;

  self.info = self.userName + ' (' + self.activity + ') ' + self.spent() + ' : ' + self.left();

  self.title = ko.computed(function(){
    if(self.id) {
      return "Edit time entry"
    } else {
      return "New time entry"
    }
  });

  self.saveOk = function(data) {
    viewModel.selectedCell().left(data.cellLeft);
    viewModel.selectedCell().spent(data.cellSpent);
    viewModel.editEntry(self);
    self.activityId(data.activityId);
    self.activity(data.activity);
    self.userId(data.userId);
    self.userName(data.userName);
    ko.utils.arrayForEach(viewModel.dailyTotals.cells, function(cell) {
      window.bdChart.series[1].data[cell.index][1] = cell.spent();
    })
    window.bdChart.replot();
    self.saved = true;
  }

  self.save = function(data) {
    var url;
    var type;
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
    if(self.id > 0) { 
      type = "put";
      url = "/scrum_report_time_entries/" + self.id;
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
      }
    });
  }

  self.cancel = function(element) {
    viewModel.selectedEntry("");
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

  self.isStory = (typeof data[days[0]][issueId].story_id != "undefined") ? false : true
  self.issueId = issueId;
  self.prevCell;
  self.storySubject = data[days[0]][issueId].story_subject;
  self.subject = data[days[0]][issueId].subject;
  self.assigneeId = ko.observable(data[days[0]][issueId].assignee_id);
  self.statusId = ko.observable(data[days[0]][issueId].status_id);
  self.assignee = ko.observable();
  self.currentStatus = ko.observable();
  self.estimated = data[days[0]][issueId].estimated;

  self.cells = ko.observableArray(
    ko.utils.arrayMap(days, function(day) {
      var cell = new Cell(data[day][issueId], day, issueId, self.prevCell);
      self.prevCell = cell;
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

  self.rows = ko.observableArray(
    ko.utils.arrayMap(data.issue_ids, function(issueId) {
      return new Row(data, data.days, issueId);
    })
  );
  self.days = data.days;
  self.dailyTotals = new DailyTotalRow(self.rows, data.days);

  self.assignees = ko.utils.arrayMap(data.assignees, function(assignee) {
      return new Assignee(assignee);
  });

  self.entries = ko.observableArray();

  // Set by cellDetails
  self.selectedEntry = ko.observable();
  // Set by cellDetails
  self.selectedCell = ko.observable();

  // By clicking on cells this gets set
  self.cellDetails = function(cell) {
    $.getJSON('/scrum_report_time_entries/' + cell.issueId + '?day=' + cell.day, function(serverData){
      var data = $.parseJSON(serverData.entries);
      var mappedEntries = $.map(data, function(entry) { return new TimeEntry(entry) });
      self.selectedCell(cell);
      if(mappedEntries.length == 0){
        var timeEntry = new TimeEntry({issueId: cell.issueId, day: cell.day});
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
    return JSON.stringify(ko.toJS(self.entries), null, '\t');
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

ko.applyBindings(viewModel);

$('#ko-body-right table.ko-table-right').width($('#ko-header-right table.ko-table-right').width())
$('#ko-body-right').scroll(function() {
  $('#ko-header-right').scrollLeft($(this).scrollLeft());
  $('#ko-body-left').scrollTop($(this).scrollTop());
  console.log("scrolled")
});

})
