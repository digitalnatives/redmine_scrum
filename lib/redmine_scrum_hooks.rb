module RedmineScrumPlugin
  module Hooks
    class LayoutHook < Redmine::Hook::ViewListener
      def view_timelog_edit_form_bottom(context={ })
        time_entry = context[:time_entry]
        return '' if time_entry[:issue_id].blank?

        issue = Issue.find(context[:time_entry].issue_id)
        snippet=''

        begin
          if issue.is_task? && User.current.allowed_to?(:te_remaining_hours, time_entry.project) != nil
            snippet += "<p><label for='remaining_hours'>#{l(:field_te_remaining_hours)} </label>"
            snippet += text_field_tag('te_remaining_hours', time_entry.te_remaining_hours, :size => 6)
            snippet += "#{l(:remaining_hours_on_issue)}: #{issue.remaining_hours}"
            snippet += '</p>'
          end
          return snippet
        rescue => e
          exception(context, e)
          return ''
        end

      end

      def controller_timelog_edit_before_save(context={ })
        time_entry = context[:time_entry]
        return '' if time_entry[:issue_id].blank?

        params = context[:params]

        issue = Issue.find(time_entry.issue_id)

        if issue.is_task? && User.current.allowed_to?(:te_remaining_hours, time_entry.project) != nil
          if params["te_remaining_hours"].present? 
            time_entry.te_remaining_hours = params[:te_remaining_hours].gsub(',','.').to_f
            temp_remaining_hours = params[:te_remaining_hours].gsub(',','.').to_f
            if temp_remaining_hours != issue.remaining_hours && (issue.time_entries.blank? || issue.time_entries.sort_by{ |te| te.spent_on }.last == time_entry)
              issue.journalized_update_attribute(:remaining_hours, temp_remaining_hours) if time_entry.save
            end
          end
        end
      end
    end
  end
end
