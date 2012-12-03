require_dependency 'issue'

module RS
  module IssuePatch
    def self.included(base) # :nodoc:
      base.extend(ClassMethods)
      base.send(:include, InstanceMethods)

      base.class_eval do
        unloadable
        if Rails::VERSION::MAJOR < 3
          named_scope :scrum_report, lambda { |conditions, condition_vars|
            {:select => "issues.id, 
                        issues.parent_id,
                        issues.status_id, 
                        issues.subject, 
                        issues.remaining_hours, 
                        issues.estimated_hours, 
                        issues.assigned_to_id,
                        sum(time_entries.hours) AS spent_time,
                        min(time_entries.spent_on) AS first_time_entry,
                        max(time_entries.spent_on) AS last_time_entry",
            :joins => "LEFT JOIN time_entries ON (time_entries.issue_id = issues.id)",
            :include => [ :status, :assigned_to ],
            :conditions => [ conditions, condition_vars ],
            :group => 'issues.id',
            :order => 'issues.parent_id DESC, issues.id ASC' }
          } 
        else
          def self.scrum_report

          end

        end
      end
    end

    module ClassMethods
    end

    module InstanceMethods
    end

  end
end

Issue.send(:include, RS::IssuePatch) unless Issue.included_modules.include? RS::IssuePatch
