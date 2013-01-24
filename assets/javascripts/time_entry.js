jQuery(function($) {

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

function TimeEntry(data) {
  var self = this;

  self.spent = ko.observable(data.spent);
  self.left = ko.observable(data.left);
  self.activityId = data.activityId;
  self.activity = data.activity;
  self.userId = data.userId;
  self.userName = data.userName;

  self.info = self.userName + ' (' + self.activity + ') ' + self.spent + ' : ' + self.left;
}

function ViewModel(data) {
  var self = this;

  self.rows = ko.observableArray(
    ko.utils.arrayMap(data.issue_ids, function(issueId) {
      return new Row(data, data.days, issueId);
    })
  )
  self.days = data.days;
  self.dailyTotals = new DailyTotalRow(self.rows, data.days);

  self.entries = ko.observableArray();

  // By clicking on cells this gets set
  self.selectedEntry = ko.observable();
  self.selectedCell = ko.observable();

  self.cellDetails = function(cell) {
    $.getJSON('/scrum_report_time_entries/' + cell.issueId + '?day=' + cell.day, function(serverData){
      var data = $.parseJSON(serverData.entries);
      var mappedEntries = $.map(data, function(entry) { return new TimeEntry(entry) });
      self.entries(mappedEntries);
      self.selectedCell(cell);
      if(mappedEntries.size == 0){
        self.selectedEntry(new TimeEntry({}));
      } else {
        self.selectedEntry(mappedEntries[0]);
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
})
