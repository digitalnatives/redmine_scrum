require_dependency 'time_entry'

module SR
  module TimeEntryPatch
    def self.included(base) # :nodoc:
      base.extend(ClassMethods)
      base.send(:include, InstanceMethods)

      base.class_eval do
        unloadable

       scope :on_version, lambda {|version| {
          :include => :issue,
          :conditions => "#{Issue.table_name}.fixed_version_id = #{version.id}"
        }}
      end
    end

    module ClassMethods
    end

    module InstanceMethods
    end

  end
end

TimeEntry.send(:include, SR::TimeEntryPatch) unless TimeEntry.included_modules.include? SR::TimeEntryPatch
