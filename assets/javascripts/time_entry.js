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

  self.spent = data.spent;
  self.left = data.left;
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
  self.selected = ko.observable();

  self.cellDetails = function(data) {
    $.getJSON('/scrum_report_time_entries/' + data.issueId + '?day=' + data.day, function(serverData){
      var data = $.parseJSON(serverData.entries);
      var mappedEntries = $.map(data, function(entry) { return new TimeEntry(entry) });
      self.entries(mappedEntries);
      self.selected({
        spent: data.spent,
        left: data.left,
      })
    })

  }

  self.editEntry = function(entry) {
    self.selected(new TimeEntry(entry));
  }

  self.previewJsonData = ko.computed(function() {
    return JSON.stringify(ko.toJS(self.entries), null, '\t');
  });
}

ko.bindingHandlers.modal = {
  init: function(element, valueAccessor) {
    $(element).dialog({
      autoOpen: false,
      modal: true,
      buttons: {
        "Save": function() {
          $('.rsindicator').addClass('rssaving');
          TE.form.trigger('submit');
        },
        "Cancel": function() {
          $(this).dialog("close");
        }
      },
    }).bind("hidden", function() {
      var data = valueAccessor();
      data(null);
    });
    return ko.bindingHandlers.with.init.apply(this, arguments);
  },

  update: function(element, valueAccessor) {
    var value = ko.utils.unwrapObservable(valueAccessor());
    //if(typeof value != "undefined" && typeof value.storyId == "undefined") return;

    $(element).dialog(value ? "open" : "close");
    return ko.bindingHandlers.with.update.apply(this, arguments);
  }
}

$('#time-entry-dialog').dialog({
  autoOpen: false,
  modal: true,
  width: 550,
  buttons: {
    "Save": function() {
      $('.rsindicator').addClass('rssaving');
    },
    "Cancel": function() {
      $(this).dialog("close");
    }
  }
});

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
