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
            snippet += "<p><label for='remaining_hours'>#{l(:field_te_remaining_hours)} #{issue.remaining_hours}</label>"
            snippet += text_field_tag('te_remaining_hours', time_entry.te_remaining_hours, :size => 6)
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
          if params.include?("te_remaining_hours")
            if time_entry.new_record?
              remaining_hours = params[:te_remaining_hours].gsub(',','.').to_f
              if remaining_hours != issue.remaining_hours.to_f
                issue.journalized_update_attribute(:remaining_hours, (remaining_hours)) if time_entry.save
              end
            else
              remaining_hours_diff = params[:te_remaining_hours].gsub(',','.').to_f - time_entry.te_remaining_hours.to_f
              if remaining_hours_diff != 0
                issue.journalized_update_attribute(:remaining_hours, (issue.remaining_hours.to_f + remaining_hours_diff)) if time_entry.save
              end
            end
            time_entry.te_remaining_hours = params[:te_remaining_hours].gsub(',','.').to_f
            Rails.logger.debug("remaining hours: #{remaining_hours}")
            Rails.logger.debug("remaining hours diff: #{remaining_hours_diff}")
            Rails.logger.debug("time_entry hours: #{time_entry.te_remaining_hours}")
            Rails.logger.debug("issue remaining hours: #{issue.remaining_hours}")
          end
        end
      end
    end
  end
end
