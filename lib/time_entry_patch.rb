require_dependency 'issue'

module RS
  module TimeEntryPatch
    def te_remaining_hours=(h)
      write_attribute :te_remaining_hours, (h.is_a?(String) ? (h.to_hours || h) : h)
    end
  end
end

TimeEntry.send(:include, RS::TimeEntryPatch) unless TimeEntry.included_modules.include? RS::TimeEntryPatch
