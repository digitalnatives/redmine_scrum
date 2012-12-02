var TE = {}

jQuery(function($) {

  TE.hoursField = $('#time_entry_hours');
  TE.remainingHoursField = $('#time_entry_te_remaining_hours');
  TE.allFields = $([]).add(TE.hoursField).add(TE.remainingHoursField);
  TE.form = $('#set-time-entry-hours');
  TE.errorExplanation = TE.form.find("#errorExplanation ul");

  TE.form.bind("ajax:success", function(xhr, data, status) {
    $('#time-entry-dialog').dialog('close');
  })
  .bind("ajax:error", function(xhr, data, status) {
    console.log(data);
    TE.handleErrors($.parseJSON(data.responseText));
  });

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
  
  TE.formEdit = function(id, values){
    this.id = id
    this.form.attr('action', '/scrum_report_time_entries/' + this.id);
    this.form.prepend(
        $('<input>')
        .attr('type', 'hidden')
        .attr('name', '_method')
        .val('put')
        );

    this.hoursField.val(values[0]);
    this.remainingHoursField.val(values[1]);
  }

  TE.formNew = function() {
    this.form.attr('action', '/scrum_report_time_entries');
  }

  TE.load = function(el) {
    if (typeof ids !== "undefined" && ids !== null) return;
    TE.errorExplanation.parent().hide();

    this.taskSubject = $(el).siblings(':eq(1)').text();
    var ids = $(el).data().timeEntryIds;
    var values = $(el).data().timeEntryValues;

    this.form.find('input[name=_method]').remove();
    switch(ids.length){
    case 0:
      this.formNew();
      break;
    case 1:
      this.formEdit(ids[0], values);
      break;
    default:
      console.log("multiple entries");
      console.log(el);
    }

    $('#task-subject').text(this.taskSubject);

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
